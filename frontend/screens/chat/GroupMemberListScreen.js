import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  TouchableOpacity,
  StatusBar,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';
import Avatar from '../../components/ui/Avatar';
import RoleBadge from '../../components/ui/RoleBadge';
import EmptyState from '../../components/ui/EmptyState';
import LoadingScreen from '../../components/ui/LoadingScreen';

export default function GroupMemberListScreen({ route, navigation }) {
  const { conversationId, groupName } = route.params;
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchMembers = async () => {
      try {
        setError('');
        const res = await api.get(`/chat/groups/${conversationId}/members`);
        setMembers(res.data.members || []);
      } catch (_err) {
        setError('Failed to fetch member list.');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [conversationId]);

  const renderItem = ({ item }) => {
    return (
      <View style={styles.itemRow}>
        <Avatar name={item.name} role={item.role} size="medium" />
        <View style={styles.details}>
          <Text style={styles.nameText}>{item.name}</Text>
          <View style={{ marginTop: 2 }}>
            <RoleBadge role={item.role} />
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor="#17212b" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ paddingRight: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#ffffff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{groupName} Members</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.container}>
        {loading ? (
          <LoadingScreen />
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={members}
            keyExtractor={(item) => item._id}
            renderItem={renderItem}
            ListEmptyComponent={<EmptyState title="No members found" />}
            contentContainerStyle={{ paddingBottom: 40 }}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#17212b',
  },
  container: {
    flex: 1,
    backgroundColor: '#17212b',
    ...(Platform.OS === 'web' && {
      maxWidth: 480,
      alignSelf: 'center',
      width: '100%',
    }),
  },
  header: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#17212b',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    flex: 1,
    textAlign: 'center',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorText: {
    color: '#e53935',
    fontSize: 14,
  },
  itemRow: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#0e1621',
  },
  details: {
    marginLeft: 12,
  },
  nameText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});
