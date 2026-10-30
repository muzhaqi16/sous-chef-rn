import React, { useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useTranslation } from '#/i18n';
import {
  Canvas,
  ClipOp,
  PaintStyle,
  Picture,
  Skia,
  StrokeCap,
  createPicture,
  type SkCanvas,
  type SkPaint,
} from '@shopify/react-native-skia';
import { StyleSheet } from 'react-native-unistyles';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { Text } from '#components/atoms/Text';
import { useMotionEnabled } from '#hooks/animations/useMotionEnabled';
import { useAnimatedTheme } from '#hooks/ui/useAnimatedTheme';
import { colors } from '#/theme/foundations/colors';
import { FRAMES, FRAME_MS } from '#components/atoms/sousChefLoaderFrames';

const COLORS = colors.illustration;

/** Every size draws the same 200-unit art, scaled; the bag is 90 units wide. */
const ART_SIDE = 200;
const SIZES = { small: 0.6, medium: 0.9, large: 1.2 };

/** The banner's width in the art; a message that widens it scales the art to match. */
const BANNER_WIDTH = 168;

/** One loop is two tosses; with no message given, each toss swaps the banner's. */
const HALF_MS = 2350;

/** The bag's centre sits this far below the canvas centre. */
const ART_OFFSET_Y = 4;

/** Where the banner's top edge meets the bag. */
const BAG_BOTTOM = 34;
/** The bag runs on under the banner, so no gap opens at its base. */
const BAG_FLOOR = 40;

type Track = Float32Array;

interface Edge {
  y: number;
  left: Track;
  right: Track;
}

/** The lowest measured height; the outline carries it on down under the banner. */
const BOTTOM_EDGE: Edge = {
  y: 33.52,
  left: FRAMES.bagLeft6,
  right: FRAMES.bagRight6,
};
/** The bag's sides, measured at seven heights below its mouth. */
const BAG_EDGES: Edge[] = [
  { y: -30.25, left: FRAMES.bagLeft0, right: FRAMES.bagRight0 },
  { y: -20.44, left: FRAMES.bagLeft1, right: FRAMES.bagRight1 },
  { y: -9.54, left: FRAMES.bagLeft2, right: FRAMES.bagRight2 },
  { y: 1.36, left: FRAMES.bagLeft3, right: FRAMES.bagRight3 },
  { y: 12.26, left: FRAMES.bagLeft4, right: FRAMES.bagRight4 },
  { y: 23.17, left: FRAMES.bagLeft5, right: FRAMES.bagRight5 },
  BOTTOM_EDGE,
];
const BAG_EDGES_UP = [...BAG_EDGES].reverse();

interface Band {
  top: Edge;
  next: Edge;
  low: Edge;
  bottom: Edge;
}

/** A shade's span at four heights; zero-width where the shade is absent. */
const bandFor = (tone: 'dark' | 'mid'): Band => ({
  top: {
    y: -16.08,
    left: FRAMES[`${tone}Left0`],
    right: FRAMES[`${tone}Right0`],
  },
  next: {
    y: 0.27,
    left: FRAMES[`${tone}Left1`],
    right: FRAMES[`${tone}Right1`],
  },
  low: {
    y: 16.62,
    left: FRAMES[`${tone}Left2`],
    right: FRAMES[`${tone}Right2`],
  },
  bottom: {
    y: 32.97,
    left: FRAMES[`${tone}Left3`],
    right: FRAMES[`${tone}Right3`],
  },
});

const DARK_BAND = bandFor('dark');
const MID_BAND = bandFor('mid');

interface SparkTracks {
  x: Track;
  y: Track;
  length: Track;
  thickness: Track;
  angle: Track;
}

const spark = (name: 'red' | 'green' | 'yellow'): SparkTracks => ({
  x: FRAMES[`${name}X`],
  y: FRAMES[`${name}Y`],
  length: FRAMES[`${name}Length`],
  thickness: FRAMES[`${name}Thickness`],
  angle: FRAMES[`${name}Angle`],
});

/** The streaks the toss throws off: tomato juice, a leaf, and the baguette's smear. */
const RED_SPARK = spark('red');
const GREEN_SPARK = spark('green');
const YELLOW_SPARK = spark('yellow');

/** Letters drop out left to right as the bag wrings, then rise back in. */
const LETTER = {
  exitAt: 380,
  exitSpread: 420,
  enterAt: 880,
  enterSpread: 300,
  duration: 320,
  tilt: 20,
};

/** The last letter is back in place by here; before `exitAt` none has moved. */
const LETTERS_SETTLED = LETTER.enterAt + LETTER.enterSpread + LETTER.duration;

/**
 * One frozen pose for a letter at rest. Reanimated commits a style only when it
 * differs shallowly from the last one, so a fresh transform array every frame
 * would commit every idle letter on every frame.
 */
const LETTER_AT_REST = [{ translateY: 0 }, { rotate: '0deg' }];

/** Frames 0–9 are one pose; the canvas holds still until the toss leaves it. */
const STILL_UNTIL_MS = FRAME_MS[9] ?? 0;

/** The baguette's base inside the bag, and its lean at rest. */
const BAGUETTE_PIVOT = { x: -19.61, y: -16.83 };
const BAGUETTE_TILT = -0.17;

const progress = (ms: number, start: number, duration: number) => {
  'worklet';
  return Math.min(Math.max((ms - start) / duration, 0), 1);
};

/** Rises past its mark and settles back. */
const backOut = (t: number) => {
  'worklet';
  const s = t - 1;
  return 1 + 2.4 * s * s * s + 1.4 * s * s;
};

/** Which toss of the loop the clock is in, and how far into it. */
const tossOf = (cycle: number) => {
  'worklet';
  const half = cycle < 0.5 ? 0 : 1;
  return { half, ms: (cycle * 2 - half) * HALF_MS };
};

interface FramePosition {
  index: number;
  next: number;
  t: number;
}

/** The two measured frames the clock sits between, and how far it is from the first. */
const framePosition = (ms: number): FramePosition => {
  'worklet';
  let index = FRAME_MS.length - 1;
  for (let i = 1; i < FRAME_MS.length; i++) {
    if (ms < (FRAME_MS[i] ?? HALF_MS)) {
      index = i - 1;
      break;
    }
  }
  const start = FRAME_MS[index] ?? 0;
  const end = FRAME_MS[index + 1] ?? HALF_MS;
  const next = index + 1 < FRAME_MS.length ? index + 1 : 0;
  return {
    index,
    next,
    t: Math.min(Math.max((ms - start) / (end - start), 0), 1),
  };
};

const sample = (track: Track, { index, next, t }: FramePosition) => {
  'worklet';
  const from = track[index] ?? 0;
  const to = track[next] ?? from;
  return from + (to - from) * t;
};

/** Carries the line through two points on to height `y`. */
const extend = (y: number, y0: number, x0: number, y1: number, x1: number) => {
  'worklet';
  return x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
};

const RAD_TO_DEG = 180 / Math.PI;

/** The bag's front: its measured mouth, then its sides down under the banner. */
const bagPath = (p: FramePosition) => {
  'worklet';
  const b = Skia.PathBuilder.Make();
  const left = sample(FRAMES.mouthLeft, p);
  const right = sample(FRAMES.mouthRight, p);
  const last = FRAMES.mouth.length - 1;
  FRAMES.mouth.forEach((track, i) => {
    const x = left + ((right - left) * i) / last;
    if (i === 0) b.moveTo(x, sample(track, p));
    else b.lineTo(x, sample(track, p));
  });
  for (const edge of BAG_EDGES) b.lineTo(sample(edge.right, p), edge.y);
  b.lineTo(sample(BOTTOM_EDGE.right, p), BAG_FLOOR);
  b.lineTo(sample(BOTTOM_EDGE.left, p), BAG_FLOOR);
  for (const edge of BAG_EDGES_UP) b.lineTo(sample(edge.left, p), edge.y);
  return b.close().detach();
};

/** A shade band, carried up past the mouth and down past the floor; the bag clips it. */
const bandPath = (band: Band, p: FramePosition) => {
  'worklet';
  const { top, next, low, bottom } = band;
  const l = [top, next, low, bottom].map(edge => sample(edge.left, p));
  const r = [top, next, low, bottom].map(edge => sample(edge.right, p));
  const [l0 = 0, l1 = 0, l2 = 0, l3 = 0] = l;
  const [r0 = 0, r1 = 0, r2 = 0, r3 = 0] = r;
  const above = -45;
  const below = 45;
  return Skia.PathBuilder.Make()
    .moveTo(extend(above, top.y, l0, next.y, l1), above)
    .lineTo(l0, top.y)
    .lineTo(l1, next.y)
    .lineTo(l2, low.y)
    .lineTo(l3, bottom.y)
    .lineTo(extend(below, low.y, l2, bottom.y, l3), below)
    .lineTo(extend(below, low.y, r2, bottom.y, r3), below)
    .lineTo(r3, bottom.y)
    .lineTo(r2, low.y)
    .lineTo(r1, next.y)
    .lineTo(r0, top.y)
    .lineTo(extend(above, top.y, r0, next.y, r1), above)
    .close()
    .detach();
};

const fill = (color: string) => {
  const paint = Skia.Paint();
  paint.setColor(Skia.Color(color));
  paint.setAntiAlias(true);
  return paint;
};

/** Made once; the scene worklet only reads them. */
const PAINT = {
  bag: fill(COLORS.bag),
  bagMid: fill(COLORS.bagMid),
  bagDark: fill(COLORS.bagDark),
  baguette: fill(COLORS.baguette),
  tomato: fill(COLORS.tomato),
  tomatoCalyx: fill(COLORS.tomatoCalyx),
  leaves: fill(COLORS.leaves),
};

const STRIPE_PAINT = fill(COLORS.baguetteLines);
STRIPE_PAINT.setStyle(PaintStyle.Stroke);
STRIPE_PAINT.setStrokeWidth(4.9);
STRIPE_PAINT.setStrokeCap(StrokeCap.Round);

/** A soft splat: a centre ringed by round lobes. */
const buildCalyx = (cx: number, cy: number) => {
  const builder = Skia.PathBuilder.Make().addCircle(cx, cy, 3.8);
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    builder.addCircle(cx + 4 * Math.cos(angle), cy + 4 * Math.sin(angle), 2.2);
  }
  return builder.detach();
};

const CALYX_PATH = buildCalyx(-5.5, -37.7);

/** The loaf, in its own upright frame: its base at 0, 0, running on under the bag. */
const BAGUETTE_BODY = Skia.RRectXY(
  Skia.XYWHRect(-13.9, -64, 27.8, 94),
  13.9,
  13.9,
);

/** Crust stripes; the loaf's outline cuts their outer ends. */
const BAGUETTE_STRIPES = [
  [-1.17, -50.61, -13.05, -46.43],
  [-0.84, -37.77, -12.73, -34.06],
  [-0.44, -24.65, -12.58, -21.17],
  [-1.07, -11.55, -10.63, -8.7],
].map(([x0 = 0, y0 = 0, x1 = 0, y1 = 0]) =>
  Skia.PathBuilder.Make().moveTo(x0, y0).lineTo(x1, y1).detach(),
);

/** The bunch spreads about its middle as it slides over the tomato. */
const GREENS_CENTRE = { x: 29.5, y: -32 };

const GREEN_CLUMPS = [
  { cx: 28.5, cy: -36, r: 8, paint: fill(COLORS.leavesDark) },
  { cx: 33.6, cy: -32.5, r: 5.8, paint: PAINT.leaves },
  { cx: 25, cy: -27.5, r: 5.5, paint: PAINT.leaves },
  { cx: 31, cy: -26, r: 7.2, paint: fill(COLORS.leavesLight) },
];

const drawBaguette = (canvas: SkCanvas, p: FramePosition) => {
  'worklet';
  const scale = sample(FRAMES.baguetteScale, p);
  const tilt = BAGUETTE_TILT + sample(FRAMES.baguetteRotate, p);
  canvas.save();
  canvas.translate(
    BAGUETTE_PIVOT.x + sample(FRAMES.baguetteX, p),
    BAGUETTE_PIVOT.y + sample(FRAMES.baguetteY, p),
  );
  canvas.scale(scale, scale);
  canvas.rotate(tilt * RAD_TO_DEG, 0, 0);
  canvas.drawRRect(BAGUETTE_BODY, PAINT.baguette);
  canvas.clipRRect(BAGUETTE_BODY, ClipOp.Intersect, true);
  for (const stripe of BAGUETTE_STRIPES) canvas.drawPath(stripe, STRIPE_PAINT);
  canvas.restore();
};

const drawGreens = (canvas: SkCanvas, p: FramePosition) => {
  'worklet';
  canvas.save();
  canvas.translate(
    GREENS_CENTRE.x + sample(FRAMES.greensX, p),
    GREENS_CENTRE.y + sample(FRAMES.greensY, p),
  );
  canvas.scale(sample(FRAMES.greensSpread, p), 1);
  canvas.translate(-GREENS_CENTRE.x, -GREENS_CENTRE.y);
  for (const clump of GREEN_CLUMPS) {
    canvas.drawCircle(clump.cx, clump.cy, clump.r, clump.paint);
  }
  canvas.restore();
};

/** A pill along its streak, centred on it. */
const drawSpark = (
  canvas: SkCanvas,
  s: SparkTracks,
  p: FramePosition,
  paint: SkPaint,
) => {
  'worklet';
  const length = sample(s.length, p);
  const thickness = sample(s.thickness, p);
  if (length <= 0 || thickness <= 0) return;
  canvas.save();
  canvas.translate(sample(s.x, p), sample(s.y, p));
  canvas.rotate(sample(s.angle, p) * RAD_TO_DEG, 0, 0);
  canvas.drawRRect(
    Skia.RRectXY(
      Skia.XYWHRect(-length / 2, -thickness / 2, length, thickness),
      thickness / 2,
      thickness / 2,
    ),
    paint,
  );
  canvas.restore();
};

/** The whole illustration at one moment of the toss, in art units. */
const drawScene = (canvas: SkCanvas, p: FramePosition) => {
  'worklet';
  // The groceries sit behind the bag's front, which hides their bases.
  drawGreens(canvas, p);
  drawBaguette(canvas, p);
  canvas.save();
  canvas.translate(sample(FRAMES.tomatoX, p), sample(FRAMES.tomatoY, p));
  canvas.drawCircle(3.5, -33.6, 18.5, PAINT.tomato);
  canvas.drawPath(CALYX_PATH, PAINT.tomatoCalyx);
  canvas.restore();
  // For a few frames the greens, then the loaf, pass in front of the tomato.
  if (sample(FRAMES.greensFront, p) >= 0.5) drawGreens(canvas, p);
  if (sample(FRAMES.baguetteFront, p) >= 0.5) drawBaguette(canvas, p);

  const bag = bagPath(p);
  canvas.drawPath(bag, PAINT.bag);
  canvas.save();
  canvas.clipPath(bag, ClipOp.Intersect, true);
  canvas.drawPath(bandPath(MID_BAND, p), PAINT.bagMid);
  canvas.drawPath(bandPath(DARK_BAND, p), PAINT.bagDark);
  canvas.restore();

  drawSpark(canvas, RED_SPARK, p, PAINT.tomato);
  drawSpark(canvas, GREEN_SPARK, p, PAINT.leaves);
  drawSpark(canvas, YELLOW_SPARK, p, PAINT.baguette);
};

/** Past twice its size's canvas, the message wraps instead of growing the banner. */
const bannerGeometry = (scale: number) => ({
  minWidth: BANNER_WIDTH * scale,
  maxWidth: ART_SIDE * scale * 2,
  minHeight: 42 * scale,
});

/** Splits a message into words of letters, each placed 0–1 along the message. */
const placeLetters = (text: string) => {
  const words = text
    .toUpperCase()
    .split(/\s+/)
    .filter(word => word !== '')
    .map(word => Array.from(word));
  const last = Math.max(words.flat().length - 1, 1);
  let index = 0;
  return words.map(word =>
    word.map(char => {
      const at = index / last;
      index += 1;
      return { char, at };
    }),
  );
};

interface BannerLetterProps {
  char: string;
  at: number;
  /** The message's toss to leave on, or `null` when one message swaps for itself. */
  slot: number | null;
  role: LetterRole;
  /** The loop held still outside the letters' window: the toss times `HALF_MS`, plus ms into it. */
  letterClock: SharedValue<number>;
  animatedTheme: ReturnType<typeof useAnimatedTheme>;
}

type LetterRole = 'label' | 'bodyStrong';

const BannerLetter: React.FC<BannerLetterProps> = ({
  char,
  at,
  slot,
  role,
  letterClock,
  animatedTheme,
}) => {
  const typeStyle = useAnimatedStyle(() => ({
    ...animatedTheme.get().type[role],
  }));

  const motionStyle = useAnimatedStyle(() => {
    const time = letterClock.get();
    const half = time >= HALF_MS ? 1 : 0;
    const ms = time - half * HALF_MS;
    const exit = progress(
      ms,
      LETTER.exitAt + at * LETTER.exitSpread,
      LETTER.duration,
    );
    const entry = progress(
      ms,
      LETTER.enterAt + at * LETTER.enterSpread,
      LETTER.duration,
    );
    const entering = slot === null ? entry > 0 : slot !== half;
    const drop = entering ? 1 - backOut(entry) : exit * exit;
    const tilt = (entering ? 1 - entry : -exit) * LETTER.tilt;
    const opacity = Math.min((entering ? entry : 1 - exit) * 2, 1);
    if (opacity === 0) return { opacity, transform: LETTER_AT_REST };
    if (drop === 0 && tilt === 0) return { opacity, transform: LETTER_AT_REST };
    const fall = animatedTheme.get().type[role].lineHeight * 1.5;
    return {
      opacity,
      transform: [{ translateY: drop * fall }, { rotate: `${tilt}deg` }],
    };
  });

  return (
    <Animated.Text style={[componentStyles.letter, typeStyle, motionStyle]}>
      {char}
    </Animated.Text>
  );
};

interface BannerProps {
  size: keyof typeof SIZES;
  messages: readonly string[];
  label: string;
  clock: SharedValue<number>;
  onWidth: (width: number) => void;
}

/** The banner sizes to its longest message; the others overlay that one. */
const Banner: React.FC<BannerProps> = ({
  size,
  messages,
  label,
  clock,
  onWidth,
}) => {
  // Variants reach only the component that sets them, so the banner sets its own.
  componentStyles.useVariants({ size });
  const animatedTheme = useAnimatedTheme();
  const ref = useRef<View>(null);
  // Fabric measures synchronously here, so the art has its size before the first
  // paint; `onLayout` follows a later change (a rotation, a new message).
  useLayoutEffect(() => {
    ref.current?.measure((_x, _y, width) => onWidth(width));
  }, [onWidth]);
  const lengths = messages.map(text => text.length);
  const flowSlot = lengths.indexOf(Math.max(...lengths));
  const alternates = messages.length > 1;
  const role: LetterRole = size === 'small' ? 'label' : 'bodyStrong';
  // Held still outside the letters' window, so their worklets sleep there.
  const letterClock = useDerivedValue(() => {
    const { half, ms } = tossOf(clock.get());
    return (
      half * HALF_MS + Math.min(Math.max(ms, LETTER.exitAt), LETTERS_SETTLED)
    );
  });

  return (
    <View
      ref={ref}
      onLayout={event => onWidth(event.nativeEvent.layout.width)}
      style={componentStyles.banner}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
    >
      <View>
        {messages.map((text, slot) => (
          <View
            key={text}
            style={
              slot === flowSlot
                ? componentStyles.line
                : componentStyles.overlayLine
            }
          >
            {placeLetters(text).map(word => (
              <View
                key={word.map(({ at }) => at).join()}
                style={componentStyles.word}
              >
                {word.map(({ char, at }) => (
                  <BannerLetter
                    key={at}
                    char={char}
                    at={at}
                    slot={alternates ? slot : null}
                    letterClock={letterClock}
                    role={role}
                    animatedTheme={animatedTheme}
                  />
                ))}
              </View>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
};

interface SousChefLoaderProps {
  size?: 'small' | 'medium' | 'large';
  /** Shown in the banner. Without one, it swaps "Please wait" and "Loading". */
  message?: string;
  showBrand?: boolean;
}

export const SousChefLoader: React.FC<SousChefLoaderProps> = ({
  size = 'medium',
  message,
  showBrand = true,
}) => {
  const { t } = useTranslation();
  const [bannerWidth, setBannerWidth] = useState(0);
  const scale = Math.max(SIZES[size], bannerWidth / BANNER_WIDTH);
  const side = ART_SIDE * scale;

  const messages =
    message === undefined
      ? [t('labels.pleaseWait'), t('labels.loading')]
      : [message];

  // One clock drives every part: a full turn is two tosses.
  const clock = useSharedValue(0);
  const motionEnabled = useMotionEnabled();

  useLayoutEffect(() => {
    if (!motionEnabled) {
      clock.set(0);
      return;
    }
    clock.set(
      withRepeat(
        withTiming(1, { duration: HALF_MS * 2, easing: Easing.linear }),
        -1,
        false,
      ),
    );
    return () => {
      cancelAnimation(clock);
    };
  }, [clock, motionEnabled]);

  // A value held still wakes nothing that reads it, so the canvas idles at rest.
  const canvasMs = useDerivedValue(() => {
    const { ms } = tossOf(clock.get());
    return ms < STILL_UNTIL_MS ? 0 : ms;
  });
  // One worklet records the whole scene, so the canvas holds one picture, not a node per shape.
  const picture = useDerivedValue(() => {
    const p = framePosition(canvasMs.get());
    return createPicture(canvas => {
      canvas.translate(side / 2, side / 2 + ART_OFFSET_Y * scale);
      canvas.scale(scale, scale);
      drawScene(canvas, p);
    }, Skia.XYWHRect(0, 0, side, side));
  });

  return (
    <View style={componentStyles.container}>
      {!!showBrand && (
        <View style={componentStyles.brandContainer}>
          <Text role="title" tone="primary" style={componentStyles.brandTitle}>
            Sous Chef
          </Text>
          <Text
            role="caption"
            tone="secondary"
            style={componentStyles.brandSubtitle}
          >
            {t('loader.brandTagline')}
          </Text>
        </View>
      )}

      {/* androidWarmup paints the first frame before Android's GPU surface is ready.
          A new size mounts a new canvas: Skia can leave one resized after mount blank. */}
      <Canvas
        key={Math.round(side)}
        androidWarmup
        style={{
          width: side,
          height: side,
          // The banner rises into the empty band under the bag to meet its base;
          // over the bag, a wrapped message would hide half the illustration.
          marginBottom: (BAG_BOTTOM + ART_OFFSET_Y) * scale - side / 2,
        }}
      >
        <Picture picture={picture} />
      </Canvas>

      {/* A view, not a canvas shape, so the banner grows to fit its message. */}
      <Banner
        size={size}
        messages={messages}
        label={message ?? t('labels.pleaseWait')}
        clock={clock}
        onWidth={setBannerWidth}
      />
    </View>
  );
};

const componentStyles = StyleSheet.create(theme => ({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  brandTitle: {
    letterSpacing: 1,
  },
  brandSubtitle: {
    marginTop: theme.spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 2,
  },
  banner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.radii.lg,
    backgroundColor: COLORS.banner,
    variants: {
      size: {
        small: bannerGeometry(SIZES.small),
        medium: bannerGeometry(SIZES.medium),
        large: bannerGeometry(SIZES.large),
      },
    },
  },
  line: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: theme.spacing.md,
  },
  overlayLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: theme.spacing.md,
  },
  word: {
    flexDirection: 'row',
    // A gap, not letterSpacing: Android drops letterSpacing on one-character text.
    columnGap: theme.spacing.xs,
  },
  letter: {
    color: COLORS.bannerText,
  },
}));
