import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  FlatList, 
  TouchableOpacity, 
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { collection, query, getDocs, orderBy, updateDoc, doc, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Card, Badge } from 'react-native-paper';

// Type pour les notifications
interface Notification {
  id: string;
  titre: string;
  message: string;
  date: Timestamp;
  type: string;
  panierId: string;
  depotId: string;
  lu: boolean;
  userId: string;
}

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Récupérer les notifications de l'utilisateur courant
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      
      // Si vous avez un système d'authentification, remplacez par l'ID de l'utilisateur connecté
      const userId = "current-user-id"; 
      
      // Version simplifiée sans orderBy pour éviter l'erreur d'index
      const q = query(
        collection(db, "notifications"),
        where("userId", "==", userId)
      );
      
      const querySnapshot = await getDocs(q);
      
      const notificationsList: Notification[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Notification));
      
      // Trier côté client au lieu de Firebase
      notificationsList.sort((a, b) => {
        // Convertir les timestamps en millisecondes et comparer
        const dateA = a.date instanceof Timestamp ? a.date.toMillis() : 0;
        const dateB = b.date instanceof Timestamp ? b.date.toMillis() : 0;
        return dateB - dateA; // Ordre décroissant
      });
      
      setNotifications(notificationsList);
      console.log(`📬 ${notificationsList.length} notifications chargées`);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des notifications:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Charger les notifications au chargement de la page
  useEffect(() => {
    fetchNotifications();
    
    // Ajouter un listener pour actualiser les notifications quand la page devient active
    const unsubscribe = navigation?.addListener?.('focus', () => {
      fetchNotifications();
    });

    // Nettoyer le listener lorsque le composant est démonté
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [navigation]);

  // Marquer une notification comme lue
  const marquerCommeLue = async (notificationId: string) => {
    try {
      const notificationRef = doc(db, "notifications", notificationId);
      await updateDoc(notificationRef, {
        lu: true
      });
      
      // Mettre à jour l'état local
      setNotifications(prevNotifs => 
        prevNotifs.map(n => 
          n.id === notificationId ? {...n, lu: true} : n
        )
      );
    } catch (error) {
      console.error("❌ Erreur lors de la mise à jour de la notification:", error);
    }
  };

  // Naviguer vers les détails du panier
  const voirDetailsPanier = (panierId: string, depotId: string) => {
    // Cette fonction devrait naviguer vers la page de détails du panier
    // Par exemple:
    // navigation.navigate('PanierDetails', { panierId, depotId });
    console.log(`Voir détails du panier ${panierId} au dépôt ${depotId}`);
    
    // Pour l'instant, affichons juste une alerte
    Alert.alert("Navigation", `Navigation vers le panier ${panierId}`);
  };

  // Formater la date pour l'affichage
  const formaterDate = (timestamp: Timestamp) => {
    try {
      const date = timestamp.toDate();
      return date.toLocaleDateString('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (error) {
      console.error("Erreur de conversion de timestamp:", error);
      return "Date inconnue";
    }
  };

  // Récupérer une icône en fonction du type de notification
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'livraison':
        return '📦';
      case 'info':
        return 'ℹ️';
      case 'alerte':
        return '⚠️';
      default:
        return '📬';
    }
  };

  // Gérer le rafraîchissement par pull-to-refresh
  const onRefresh = () => {
    setRefreshing(true);
    fetchNotifications();
  };

  // Obtenir le nombre de notifications non lues
  const getNonLuesCount = () => {
    return notifications.filter(n => !n.lu).length;
  };

  // Marquer toutes les notifications comme lues
  const marquerToutesLues = async () => {
    try {
      const nonLues = notifications.filter(n => !n.lu);
      
      if (nonLues.length === 0) {
        Alert.alert("Information", "Aucune notification non lue");
        return;
      }
      
      // Mettre à jour en batch dans Firestore
      const promises = nonLues.map(notification => {
        const notifRef = doc(db, "notifications", notification.id);
        return updateDoc(notifRef, { lu: true });
      });
      
      await Promise.all(promises);
      
      // Mettre à jour l'état local
      setNotifications(prev => 
        prev.map(n => ({ ...n, lu: true }))
      );
      
      Alert.alert("Succès", "Toutes les notifications ont été marquées comme lues");
    } catch (error) {
      console.error("Erreur lors de la mise à jour des notifications:", error);
      Alert.alert("Erreur", "Impossible de marquer les notifications comme lues");
    }
  };

  // Rendu d'une notification
  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity 
      onPress={() => {
        marquerCommeLue(item.id);
        if (item.panierId) {
          voirDetailsPanier(item.panierId, item.depotId);
        }
      }}
      style={styles.notificationTouchable}
    >
      <Card 
        style={[
          styles.notificationCard, 
          !item.lu && styles.nonLuCard
        ]}
      >
        <Card.Content style={styles.cardContent}>
          <View style={styles.iconContainer}>
            <Text style={styles.notificationIcon}>{getNotificationIcon(item.type)}</Text>
          </View>
          
          <View style={styles.contentContainer}>
            <View style={styles.headerContainer}>
              <Text style={styles.notificationTitle}>{item.titre}</Text>
              {!item.lu && (
                <Badge style={styles.badge}>Nouveau</Badge>
              )}
            </View>
            
            <Text style={styles.notificationMessage}>{item.message}</Text>
            <Text style={styles.notificationDate}>{formaterDate(item.date)}</Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notifications</Text>
        <View style={styles.headerActions}>
          {getNonLuesCount() > 0 && (
            <TouchableOpacity 
              style={styles.markAllButton}
              onPress={marquerToutesLues}
            >
              <Text style={styles.markAllButtonText}>Tout marquer comme lu</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity 
            style={styles.refreshButton}
            onPress={fetchNotifications}
          >
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {loading && !refreshing ? (
        <View style={styles.loaderContainer}>
          <ActivityIndicator size="large" color="#4caf50" />
          <Text style={styles.loadingText}>Chargement des notifications...</Text>
        </View>
      ) : notifications.length > 0 ? (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={['#4caf50']}
              tintColor="#4caf50"
            />
          }
        />
      ) : (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Aucune notification</Text>
          <TouchableOpacity 
            style={styles.button}
            onPress={fetchNotifications}
          >
            <Text style={styles.buttonText}>Actualiser</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  markAllButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginRight: 10,
  },
  markAllButtonText: {
    color: 'white',
    fontSize: 12,
  },
  refreshButton: {
    backgroundColor: '#333',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  listContainer: {
    padding: 16,
  },
  notificationTouchable: {
    marginBottom: 12,
  },
  notificationCard: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
  },
  nonLuCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#4caf50',
  },
  cardContent: {
    flexDirection: 'row',
  },
  iconContainer: {
    marginRight: 12,
    justifyContent: 'center',
  },
  notificationIcon: {
    fontSize: 24,
  },
  contentContainer: {
    flex: 1,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4caf50',
  },
  badge: {
    backgroundColor: '#4caf50',
  },
  notificationMessage: {
    fontSize: 14,
    color: '#e0e0e0',
    marginBottom: 8,
  },
  notificationDate: {
    fontSize: 12,
    color: '#b0b0b0',
    fontStyle: 'italic',
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: 'white',
    marginTop: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
  },
  button: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    width: '60%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
});