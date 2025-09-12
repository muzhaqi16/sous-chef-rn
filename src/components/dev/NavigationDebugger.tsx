import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {useNavigationState} from '#hooks';
import {useStore} from '#store';

interface NavigationDebuggerProps {
  visible?: boolean;
}

export const NavigationDebugger: React.FC<NavigationDebuggerProps> = ({
  visible = false,
}) => {
  const {
    navigationState,
    targetRoute,
    isReady,
    authStackInitialRoute,
    onboardingInitialRoute,
    hasStoredCredentials,
  } = useNavigationState();

  const {user, isHydrated, onBoardingStep, rememberMe, getUserNavigationState} =
    useStore();

  const [expanded, setExpanded] = useState(false);

  if (!visible && !__DEV__) return null;

  // Get user navigation state if user exists
  const userNavState = user?.id ? getUserNavigationState(user.id) : null;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}>
        <Text style={styles.headerText}>
          🔧 Navigation Debug {expanded ? '▼' : '▶'}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{navigationState}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.content} nestedScrollEnabled>
          {/* Current State Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Navigation State</Text>
            <Text style={styles.stateText}>
              State: <Text style={styles.highlight}>{navigationState}</Text>
            </Text>
            <Text style={styles.stateText}>
              Target Route: <Text style={styles.highlight}>{targetRoute}</Text>
            </Text>
            <Text style={styles.stateText}>
              Ready:{' '}
              <Text style={styles.highlight}>{isReady ? 'Yes' : 'No'}</Text>
            </Text>
          </View>

          {/* App State */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>App State</Text>
            <Text style={styles.stateText}>
              Hydrated:{' '}
              <Text style={styles.highlight}>{isHydrated ? 'Yes' : 'No'}</Text>
            </Text>
            <Text style={styles.stateText}>
              Has Credentials:{' '}
              <Text style={styles.highlight}>
                {hasStoredCredentials === null
                  ? 'Checking...'
                  : hasStoredCredentials
                    ? 'Yes'
                    : 'No'}
              </Text>
            </Text>
            <Text style={styles.stateText}>
              Remember Me:{' '}
              <Text style={styles.highlight}>
                {rememberMe === undefined
                  ? 'Not Set'
                  : rememberMe
                    ? 'Yes'
                    : 'No'}
              </Text>
            </Text>
          </View>

          {/* User Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>User Info</Text>
            {user ? (
              <>
                <Text style={styles.stateText}>
                  ID:{' '}
                  <Text style={styles.highlight}>{user.id.slice(0, 8)}...</Text>
                </Text>
                <Text style={styles.stateText}>
                  Email: <Text style={styles.highlight}>{user.email}</Text>
                </Text>
                <Text style={styles.stateText}>
                  Verified:{' '}
                  <Text style={styles.highlight}>
                    {user.emailVerified ? 'Yes' : 'No'}
                  </Text>
                </Text>
                <Text style={styles.stateText}>
                  Onboarded:{' '}
                  <Text style={styles.highlight}>
                    {user.onBoarded ? 'Yes' : 'No'}
                  </Text>
                </Text>
              </>
            ) : (
              <Text style={styles.emptyText}>No user logged in</Text>
            )}
          </View>

          {/* Onboarding State */}
          {!user?.onBoarded && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Onboarding</Text>
              <Text style={styles.stateText}>
                Current Step:{' '}
                <Text style={styles.highlight}>
                  {onBoardingStep || 'Not Started'}
                </Text>
              </Text>
              <Text style={styles.stateText}>
                Initial Route:{' '}
                <Text style={styles.highlight}>{onboardingInitialRoute}</Text>
              </Text>
              {userNavState?.onboardingProgress && (
                <Text style={styles.stateText}>
                  Saved Progress:{' '}
                  <Text style={styles.highlight}>
                    {userNavState.onboardingProgress}
                  </Text>
                </Text>
              )}
              {userNavState?.skippedOnboardingSteps && (
                <Text style={styles.stateText}>
                  Skipped:{' '}
                  <Text style={styles.highlight}>
                    {userNavState.skippedOnboardingSteps.join(', ')}
                  </Text>
                </Text>
              )}
            </View>
          )}

          {/* Auth Stack State */}
          {navigationState === 'UNAUTHENTICATED' && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Auth Stack</Text>
              <Text style={styles.stateText}>
                Initial Route:{' '}
                <Text style={styles.highlight}>{authStackInitialRoute}</Text>
              </Text>
            </View>
          )}

          {/* User Navigation State */}
          {userNavState && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>User Navigation State</Text>
              {userNavState.rememberMeChoice !== undefined && (
                <Text style={styles.stateText}>
                  Remember Choice:{' '}
                  <Text style={styles.highlight}>
                    {userNavState.rememberMeChoice ? 'Yes' : 'No'}
                  </Text>
                </Text>
              )}
              {userNavState.lastLoginTimestamp && (
                <Text style={styles.stateText}>
                  Last Login:{' '}
                  <Text style={styles.highlight}>
                    {new Date(
                      userNavState.lastLoginTimestamp,
                    ).toLocaleTimeString()}
                  </Text>
                </Text>
              )}
              {userNavState.onboardingStartedAt && (
                <Text style={styles.stateText}>
                  Onboarding Started:{' '}
                  <Text style={styles.highlight}>
                    {new Date(
                      userNavState.onboardingStartedAt,
                    ).toLocaleTimeString()}
                  </Text>
                </Text>
              )}
              {userNavState.isNewUser !== undefined && (
                <Text style={styles.stateText}>
                  New User:{' '}
                  <Text style={styles.highlight}>
                    {userNavState.isNewUser ? 'Yes' : 'No'}
                  </Text>
                </Text>
              )}
            </View>
          )}

          {/* Debug Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Debug Actions</Text>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => {
                console.log('Navigation State:', {
                  navigationState,
                  targetRoute,
                  isReady,
                  authStackInitialRoute,
                  onboardingInitialRoute,
                  hasStoredCredentials,
                });
              }}>
              <Text style={styles.debugButtonText}>Log Navigation State</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() => {
                console.log('User State:', {
                  user,
                  userNavState,
                  onBoardingStep,
                });
              }}>
              <Text style={styles.debugButtonText}>Log User State</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.9)',
    borderRadius: 8,
    minWidth: 200,
    maxWidth: 320,
    zIndex: 9999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
  },
  headerText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  badge: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  content: {
    maxHeight: 400,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#444',
    paddingBottom: 4,
  },
  stateText: {
    color: '#ccc',
    fontSize: 12,
    marginBottom: 4,
  },
  highlight: {
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#666',
    fontSize: 11,
    fontStyle: 'italic',
  },
  debugButton: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  debugButtonText: {
    color: 'white',
    fontSize: 11,
    textAlign: 'center',
  },
});
