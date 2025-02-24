import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, Animated } from 'react-native';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Appbar, Card, Title, Paragraph, Button, Divider, Dialog, Portal, Snackbar, Provider as PaperProvider, ActivityIndicator } from 'react-native-paper';

interface Depot {
  id: string;
  lieu: string;
  adresse: string;
  horaires: string;
  numeros_depot?: string[];
}

interface Tournee {
  id: string;
  nom: string;
  depots: Depot[];
}

const TourneesScreen: React.FC = () => {
  const [tournees, setTournees] = useState<Tournee[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTournees, setExpandedTournees] = useState<{ [key: string]: boolean }>({});
  const [selectedTournee, setSelectedTournee] = useState<Tournee | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  
  // Variables pour l'animation de démarrage
  const [tourneeProgress, setTourneeProgress] = useState(0);
  const progressAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(1))[0];
  const opacityAnim = useState(new Animated.Value(1))[0];

  // 🔹 Récupération des tournées Firestore
  useEffect(() => {
    const fetchTournees = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'tournees'));
        const tourneeList: Tournee[] = [];

        for (const docSnap of querySnapshot.docs) {
          const tourneeData = docSnap.data();
          const depots: Depot[] = [];

          if (Array.isArray(tourneeData.points_depots)) {
            for (const depotId of tourneeData.points_depots) {
              const depotRef = doc(db, "points_depots", depotId);
              const depotSnap = await getDoc(depotRef);

              if (depotSnap.exists()) {
                depots.push({ id: depotSnap.id, ...depotSnap.data() } as Depot);
              } else {
                console.warn(`⚠️ Dépôt introuvable : ${depotId}`);
              }
            }
          }

          tourneeList.push({
            id: docSnap.id,
            nom: tourneeData.nom,
            depots: depots,
          });
        }

        console.log("🔥 Tournées chargées :", tourneeList);
        setTournees(tourneeList);
      } catch (error) {
        console.error("❌ Erreur lors du chargement des tournées :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTournees();
  }, []);

  // 🔹 Gestion de l'affichage des dépôts
  const toggleExpand = (id: string) => {
    setExpandedTournees((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleStartTournee = (tournee: Tournee) => {
    setSelectedTournee(tournee);
    setModalVisible(true);
    // Réinitialiser les animations
    progressAnim.setValue(0);
    scaleAnim.setValue(1);
    opacityAnim.setValue(1);
    setTourneeProgress(0);
  };

  const confirmStartTournee = () => {
    // Animation de progression
    const animateProgress = () => {
      // Animer la barre de progression
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      }).start(() => {
        // Animation de succès
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.2,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 500,
            useNativeDriver: true,
          })
        ]).start(() => {
          setTimeout(() => {
            setModalVisible(false);
            setSuccessMessage(`🚀 Tournée ${selectedTournee?.nom} démarrée !`);
          }, 500);
        });
      });
      
      // Animation visuelle de progression pour l'UI
      let progress = 0;
      const interval = setInterval(() => {
        progress += 0.1;
        setTourneeProgress(Math.min(progress, 1));
        if (progress >= 1) clearInterval(interval);
      }, 200);
    };
    
    animateProgress();
  };

  return (
    <PaperProvider>
      <View style={styles.container}>
        {/* ✅ Barre de navigation */}
        <Appbar.Header style={styles.appbar}>
          <Appbar.Content title="📍 Tournées du jour" subtitle={`${tournees.length} tournée${tournees.length > 1 ? 's' : ''}`} />
        </Appbar.Header>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color="#4caf50" size="large" />
            <Paragraph style={styles.loadingText}>Chargement des tournées...</Paragraph>
          </View>
        ) : (
          <FlatList
            data={tournees}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContainer}
            renderItem={({ item }) => {
              const isExpanded = expandedTournees[item.id] || false;
              const displayedDepots = isExpanded ? item.depots : item.depots.slice(0, 3);
              return (
                <Card style={styles.tourneeCard}>
                  <Card.Content>
                    <Title style={styles.tourneeTitle}>{item.nom}</Title>
                    <Paragraph style={styles.depotCount}>
                      {item.depots.length} point{item.depots.length > 1 ? 's' : ''} de dépôt
                    </Paragraph>
                    <Divider style={styles.divider} />

                    {/* ✅ Affichage des points de dépôt */}
                    {displayedDepots.map((depot, index) => (
                      <Card key={index} style={styles.depotCard}>
                        <Card.Content>
                          <Title style={styles.depotLieu}>{depot.lieu}</Title>
                          <Paragraph style={styles.depotInfo}>{depot.adresse}</Paragraph>
                          <Paragraph style={styles.depotInfo}>{depot.horaires}</Paragraph>
                          <View style={styles.depotNumeroContainer}>
                            <Title style={styles.depotNumeroLabel}>🗄️ N° dépôt :</Title>
                            <Paragraph style={styles.depotNumero}>
                              {depot.numeros_depot?.join(", ") ?? "Non spécifié"}
                            </Paragraph>
                          </View>
                        </Card.Content>
                      </Card>
                    ))}

                    {/* ✅ Bouton "Voir plus" si plus de 3 points */}
                    {item.depots.length > 3 && (
                      <Button
                        mode="outlined"
                        onPress={() => toggleExpand(item.id)}
                        style={styles.seeMoreButton}
                        icon={isExpanded ? "chevron-up" : "chevron-down"}
                      >
                        {isExpanded ? "Voir moins" : "Voir plus"}
                      </Button>
                    )}
                  </Card.Content>
                  <Card.Actions style={styles.cardActions}>
                    <Button 
                      mode="contained" 
                      onPress={() => handleStartTournee(item)}
                      icon="play"
                      style={styles.startButton}
                    >
                      Démarrer
                    </Button>
                  </Card.Actions>
                </Card>
              );
            }}
          />
        )}

        {/* ✅ MODALE DE CONFIRMATION AMÉLIORÉE */}
        <Portal>
          <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)} style={styles.modal}>
            <Animated.View style={{
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim
            }}>
              <Dialog.Title style={styles.dialogTitle}>🚀 Démarrage de tournée</Dialog.Title>
              <Dialog.Content>
                <View style={styles.modalContent}>
                  <Title style={styles.modalTournee}>{selectedTournee?.nom}</Title>
                  <Paragraph style={styles.modalDepots}>
                    {selectedTournee?.depots.length} point{selectedTournee?.depots.length !== 1 ? 's' : ''} de dépôt
                  </Paragraph>
                  
                  <Paragraph style={styles.confirmText}>
                    Voulez-vous vraiment démarrer cette tournée ?
                  </Paragraph>
                  
                  {/* Barre de progression animée */}
                  <View style={styles.progressContainer}>
                    <Animated.View 
                      style={[
                        styles.progressBar,
                        { width: progressAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: ['0%', '100%']
                          })
                        }
                      ]} 
                    />
                  </View>
                  
                  {tourneeProgress === 1 && (
                    <View style={styles.completedContainer}>
                      <Title style={styles.completedText}>Prêt à démarrer !</Title>
                    </View>
                  )}
                </View>
              </Dialog.Content>
              <Dialog.Actions>
                <Button mode="outlined" onPress={() => setModalVisible(false)} style={styles.cancelButton}>
                  Annuler
                </Button>
                <Button 
                  mode="contained" 
                  onPress={confirmStartTournee} 
                  style={styles.confirmButton}
                  disabled={tourneeProgress === 1}
                >
                  {tourneeProgress === 1 ? "Terminé" : "Confirmer"}
                </Button>
              </Dialog.Actions>
            </Animated.View>
          </Dialog>
        </Portal>

        <Snackbar 
          visible={!!successMessage} 
          onDismiss={() => setSuccessMessage(null)}
          duration={3000}
          style={styles.snackbar}
          action={{
            label: 'OK',
            onPress: () => setSuccessMessage(null),
          }}
        >
          {successMessage}
        </Snackbar>
      </View>
    </PaperProvider>
  );
};

// 🎨 **Styles améliorés**
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#121212' 
  },
  appbar: { 
    backgroundColor: '#1f1f1f',
    elevation: 4 
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: { 
    textAlign: 'center', 
    marginTop: 20, 
    fontSize: 16, 
    color: '#ffffff' 
  },
  listContainer: {
    padding: 8,
  },
  tourneeCard: { 
    margin: 8, 
    backgroundColor: '#2c2c2c', 
    borderRadius: 10,
    elevation: 3, 
    overflow: 'hidden',
  },
  tourneeTitle: { 
    fontSize: 22, 
    fontWeight: 'bold', 
    textAlign: 'center', 
    color: '#4caf50',
    marginBottom: 4,
  },
  depotCount: { 
    textAlign: 'center', 
    color: '#b0b0b0',
    fontSize: 16,
  },
  divider: { 
    marginVertical: 12, 
    backgroundColor: '#4a4a4a', 
    height: 1 
  },
  depotCard: { 
    marginVertical: 6, 
    backgroundColor: '#3c3c3c', 
    borderRadius: 8, 
    padding: 6,
    elevation: 2,
  },
  depotLieu: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    color: '#4caf50',
    marginBottom: 4,
  },
  depotInfo: { 
    fontSize: 15, 
    color: '#e0e0e0',
    marginBottom: 2,
  },
  depotNumeroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
  },
  depotNumeroLabel: {
    fontSize: 16,
    marginRight: 8,
    color: '#e0e0e0',
  },
  depotNumero: { 
    fontSize: 15, 
    color: '#e0e0e0',
    fontWeight: 'bold',
  },
  seeMoreButton: { 
    marginTop: 12, 
    alignSelf: 'center', 
    borderColor: '#4caf50',
    borderRadius: 20,
  },
  cardActions: {
    padding: 12,
    justifyContent: 'flex-end'
  },
  startButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 16,
    borderRadius: 20,
  },
  modal: {
    backgroundColor: '#2c2c2c',
    borderRadius: 12,
    padding: 4,
  },
  dialogTitle: {
    color: '#4caf50',
    textAlign: 'center',
    fontSize: 20,
  },
  modalContent: {
    alignItems: 'center',
    padding: 8,
  },
  modalTournee: {
    fontSize: 24,
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDepots: {
    fontSize: 16,
    color: '#b0b0b0',
    marginBottom: 20,
  },
  confirmText: {
    fontSize: 16,
    color: '#e0e0e0',
    textAlign: 'center',
    marginBottom: 24,
  },
  progressContainer: {
    height: 8,
    backgroundColor: '#3e3e3e',
    width: '100%',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
  },
  completedContainer: {
    marginTop: 16,
    alignItems: 'center',
  },
  completedText: {
    color: '#4caf50',
    fontSize: 18,
  },
  cancelButton: {
    borderColor: '#b0b0b0',
    borderRadius: 20,
    marginRight: 8,
  },
  confirmButton: {
    backgroundColor: '#4caf50',
    borderRadius: 20,
  },
  snackbar: {
    backgroundColor: '#333333',
  },
});

export default TourneesScreen;