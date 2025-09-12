import React, {useState} from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import {useNavigationState, NavigationState} from '#hooks';

interface NavigationDebuggerProps {
  visible?: boolean;
}

export const NavigationDebugger: React.FC<NavigationDebuggerProps> = ({
  visible = false,
}) => {
  const {
    navigationState,
    canTransitionTo,
    transitionTo,
    forceTransition,
    getTransitionHistory,
    getStateMachineInfo,
    computedState,
  } = useNavigationState();

  const [expanded, setExpanded] = useState(false);

  if (!visible && !__DEV__) return null;

  const stateMachineInfo = getStateMachineInfo();
  const transitionHistory = getTransitionHistory();

  const handleForceTransition = (newState: NavigationState) => {
    forceTransition(newState, 'Developer Tools');
  };

  const isStateComputed = navigationState === computedState;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={() => setExpanded(!expanded)}>
        <Text style={styles.headerText}>
          🔧 Navigation State Machine {expanded ? '▼' : '▶'}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{navigationState}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <ScrollView style={styles.content} nestedScrollEnabled>
          {/* Current State Info */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Current State</Text>
            <Text style={styles.stateText}>
              Navigation:{' '}
              <Text style={styles.highlight}>{navigationState}</Text>
            </Text>
            <Text style={styles.stateText}>
              Computed: <Text style={styles.highlight}>{computedState}</Text>
            </Text>
            {!isStateComputed && (
              <Text style={styles.warningText}>
                ⚠️ State mismatch detected!
              </Text>
            )}
          </View>

          {/* Possible Transitions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Valid Transitions</Text>
            <View style={styles.transitionGrid}>
              {stateMachineInfo.possibleTransitions.map(state => (
                <TouchableOpacity
                  key={state}
                  style={[
                    styles.transitionButton,
                    canTransitionTo(state) && styles.validTransition,
                  ]}
                  onPress={() => handleForceTransition(state)}>
                  <Text style={styles.transitionText}>{state}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Transition History */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              Transition History ({transitionHistory.length})
            </Text>
            {transitionHistory.slice(0, 5).map((transition, index) => (
              <View key={index} style={styles.historyItem}>
                <Text style={styles.historyText}>
                  {transition.from} → {transition.to}
                </Text>
                <Text style={styles.historyEvent}>{transition.event}</Text>
                <Text style={styles.historyTime}>
                  {new Date(transition.timestamp).toLocaleTimeString()}
                </Text>
              </View>
            ))}
            {transitionHistory.length === 0 && (
              <Text style={styles.emptyText}>No transitions yet</Text>
            )}
          </View>

          {/* Debug Actions */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Debug Actions</Text>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() =>
                console.log('Navigation State Machine Info:', stateMachineInfo)
              }>
              <Text style={styles.debugButtonText}>Log State Machine Info</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.debugButton}
              onPress={() =>
                console.log('Transition History:', transitionHistory)
              }>
              <Text style={styles.debugButtonText}>Log Transition History</Text>
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
    backgroundColor: 'rgba(0,0,0,0.8)',
    borderRadius: 8,
    minWidth: 200,
    maxWidth: 300,
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
  warningText: {
    color: '#FF9800',
    fontSize: 12,
    fontStyle: 'italic',
  },
  transitionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  transitionButton: {
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 60,
  },
  validTransition: {
    backgroundColor: '#4CAF50',
  },
  transitionText: {
    color: 'white',
    fontSize: 10,
    textAlign: 'center',
  },
  historyItem: {
    backgroundColor: '#222',
    padding: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  historyText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  historyEvent: {
    color: '#81C784',
    fontSize: 10,
  },
  historyTime: {
    color: '#999',
    fontSize: 9,
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
