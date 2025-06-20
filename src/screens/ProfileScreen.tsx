import React from 'react';
import {
  StyleSheet,
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Image,
} from 'react-native';
import FeatherIcon from '@react-native-vector-icons/feather';
import MaterialCommunityIcons from '@react-native-vector-icons/material-icons';

export default function Example() {
  return (
    <SafeAreaView style={{flex: 1, backgroundColor: '#f8f8f8'}}>
      <View style={styles.header}>
        <View style={styles.headerAction}>
          <TouchableOpacity
            onPress={() => {
              // handle onPress
            }}>
            <FeatherIcon color="#000" name="arrow-left" size={24} />
          </TouchableOpacity>
        </View>

        <Text numberOfLines={1} style={styles.headerTitle}>
          Account
        </Text>

        <View style={[styles.headerAction, {alignItems: 'flex-end'}]}>
          <TouchableOpacity
            onPress={() => {
              // handle onPress
            }}>
            <FeatherIcon color="#000" name="more-vertical" size={24} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatar}>
          <Image
            alt=""
            source={{
              uri: 'https://images.unsplash.com/photo-1633332755192-727a05c4013d?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=facearea&facepad=2.5&w=256&h=256&q=80',
            }}
            style={styles.avatarImg}
          />

          <View style={styles.avatarIcon}>
            <FeatherIcon color="#fff" name="camera" size={14} />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.sectionBody}>
            <View style={[styles.rowWrapper, styles.rowFirst]}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Username</Text>

                <View style={styles.rowSpacer} />

                <Text style={styles.rowValue}>@johndoe</Text>
              </View>
            </View>

            <View style={styles.rowWrapper}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <Text style={styles.rowLabel}>Name</Text>

                <View style={styles.rowSpacer} />

                <Text style={styles.rowValue}>John Doe</Text>

                <FeatherIcon color="#bcbcbc" name="chevron-right" size={19} />
              </TouchableOpacity>
            </View>

            <View style={styles.rowWrapper}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <Text style={styles.rowLabel}>Phone</Text>

                <View style={styles.rowSpacer} />

                <Text style={styles.rowValue}>(123) 456-7890</Text>

                <FeatherIcon color="#bcbcbc" name="chevron-right" size={19} />
              </TouchableOpacity>
            </View>

            <View style={styles.rowWrapper}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <Text style={styles.rowLabel}>Birthday</Text>

                <View style={styles.rowSpacer} />

                <Text style={styles.rowValue}>May 5th, 1996</Text>

                <FeatherIcon color="#bcbcbc" name="chevron-right" size={19} />
              </TouchableOpacity>
            </View>

            <View style={[styles.rowWrapper, styles.rowLast]}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <Text style={styles.rowLabel}>Country</Text>

                <View style={styles.rowSpacer} />

                <Text style={styles.rowValue}>United States</Text>

                <FeatherIcon color="#bcbcbc" name="chevron-right" size={19} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Login Information</Text>

          <View style={styles.sectionBody}>
            <View style={[styles.rowWrapper, styles.rowFirst]}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <Text style={styles.rowLabel}>Email</Text>

                <View style={styles.rowSpacer} />

                <Text style={styles.rowValue}>john@example.com</Text>

                <FeatherIcon color="#bcbcbc" name="chevron-right" size={19} />
              </TouchableOpacity>
            </View>

            <View style={[styles.rowWrapper, styles.rowLast]}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <Text style={styles.rowLabel}>Update password</Text>

                <View style={styles.rowSpacer} />

                <FeatherIcon color="#bcbcbc" name="chevron-right" size={19} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Social Accounts</Text>

          <View style={styles.sectionBody}>
            <View style={[styles.rowWrapper, styles.rowFirst]}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <MaterialCommunityIcons color="#000" name="apple" size={19} />

                <Text style={[styles.rowLabel, styles.rowLabelSocial]}>
                  Apple
                </Text>

                <View style={styles.rowSpacer} />

                <Text style={[styles.rowValue, styles.rowValueSuccess]}>
                  Connected
                </Text>

                <FeatherIcon color="#bcbcbc" name="x" size={16} />
              </TouchableOpacity>
            </View>

            <View style={styles.rowWrapper}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <MaterialCommunityIcons color="#000" name="discord" size={19} />

                <Text style={[styles.rowLabel, styles.rowLabelSocial]}>
                  Discord
                </Text>

                <View style={styles.rowSpacer} />

                <Text style={[styles.rowValue, styles.rowValueSuccess]}>
                  Connected
                </Text>

                <FeatherIcon color="#bcbcbc" name="x" size={16} />
              </TouchableOpacity>
            </View>

            <View style={[styles.rowWrapper, styles.rowLast]}>
              <TouchableOpacity
                onPress={() => {
                  // handle onPress
                }}
                style={styles.row}>
                <MaterialCommunityIcons
                  color="#000"
                  name="facebook"
                  size={19}
                />

                <Text style={[styles.rowLabel, styles.rowLabelSocial]}>
                  Facebook
                </Text>

                <View style={styles.rowSpacer} />

                <Text style={[styles.rowValue, styles.rowValueDanger]}>
                  Needs Verification
                </Text>

                <FeatherIcon color="#bcbcbc" name="chevron-right" size={19} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
  },
  /** Header */
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 16,
  },
  headerAction: {
    width: 40,
    height: 40,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: '600',
    color: '#000',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
    textAlign: 'center',
  },
  /** Avatar */
  avatar: {
    position: 'relative',
    marginVertical: 12,
    alignSelf: 'center',
  },
  avatarImg: {
    width: 80,
    height: 80,
    borderRadius: 9999,
  },
  avatarIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    borderRadius: 9999,
    borderWidth: 2,
    borderColor: '#fff',
    bottom: 0,
    right: -2,
    padding: 4,
    backgroundColor: '#3C81F0',
  },
  /** Section */
  section: {
    paddingVertical: 12,
  },
  sectionTitle: {
    margin: 8,
    marginLeft: 12,
    fontSize: 13,
    letterSpacing: 0.33,
    fontWeight: '500',
    color: '#a69f9f',
    textTransform: 'uppercase',
  },
  sectionBody: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.2,
    shadowRadius: 1.41,
    elevation: 2,
  },
  /** Row */
  row: {
    height: 44,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingRight: 12,
  },
  rowWrapper: {
    paddingLeft: 16,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderColor: '#f0f0f0',
  },
  rowFirst: {
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  rowLabel: {
    fontSize: 16,
    letterSpacing: 0.24,
    color: '#000',
  },
  rowSpacer: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 0,
  },
  rowValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ababab',
    marginRight: 4,
  },
  rowLast: {
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  rowLabelSocial: {
    marginLeft: 8,
    fontWeight: '600',
  },
  rowValueSuccess: {
    fontWeight: '600',
    color: '#3C81F0',
    marginRight: 8,
  },
  rowValueDanger: {
    fontWeight: '600',
    color: '#dc2626',
  },
});
