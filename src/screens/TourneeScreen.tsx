import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { collection, getDocs, getDoc, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Appbar, Card, Title, Paragraph, Button, Divider, Dialog, Portal, Snackbar, Provider as PaperProvider } from 'react-native-paper';

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
  };

  const confirmStartTournee = () => {
    setModalVisible(false);
    setSuccessMessage(`🚀 Tournée ${selectedTournee?.nom} démarrée !`);
  };

  return (
    <PaperProvider>
      <View style={styles.container}>
        {/* ✅ Barre de navigation */}
        <Appbar.Header style={styles.appbar}>
          <Appbar.Content title="📍 Tournées du jour" />
        </Appbar.Header>

        {loading ? (
          <Paragraph style={styles.loadingText}>Chargement des tournées...</Paragraph>
        ) : (
          <FlatList
            data={tournees}
            keyExtractor={(item) => item.id}
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
                          <Paragraph style={styles.depotNumero}>
                            <Title>🗄️ N° dépôt :</Title> {depot.numeros_depot?.join(", ") ?? "Non spécifié"}
                          </Paragraph>
                        </Card.Content>
                      </Card>
                    ))}

                    {/* ✅ Bouton "Voir plus" si plus de 3 points */}
                    {item.depots.length > 3 && (
                      <Button
                        mode="outlined"
                        onPress={() => toggleExpand(item.id)}
                        style={styles.seeMoreButton}
                      >
                        {isExpanded ? "Voir moins" : "Voir plus"}
                      </Button>
                    )}
                  </Card.Content>
                  <Card.Actions>
                    <Button mode="contained" onPress={() => handleStartTournee(item)}>
                      Démarrer
                    </Button>
                  </Card.Actions>
                </Card>
              );
            }}
          />
        )}

        {/* ✅ MODALE DE CONFIRMATION */}
        <Portal>
          <Dialog visible={modalVisible} onDismiss={() => setModalVisible(false)}>
            <Dialog.Title>🚀 Confirmation</Dialog.Title>
            <Dialog.Content>
              <Paragraph>Voulez-vous vraiment démarrer la tournée "{selectedTournee?.nom}" ?</Paragraph>
            </Dialog.Content>
            <Dialog.Actions>
              <Button mode="outlined" onPress={() => setModalVisible(false)}>Annuler</Button>
              <Button mode="contained" onPress={confirmStartTournee}>Confirmer</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>

        <Snackbar visible={!!successMessage} onDismiss={() => setSuccessMessage(null)}>
          {successMessage}
        </Snackbar>
      </View>
    </PaperProvider>
  );
};

// 🎨 **Styles corrigés**
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  appbar: { backgroundColor: '#1f1f1f' },
  loadingText: { textAlign: 'center', marginTop: 20, fontSize: 16, color: '#ffffff' },
  tourneeCard: { margin: 10, padding: 10, backgroundColor: '#2c2c2c', borderRadius: 10 },
  tourneeTitle: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', color: '#4caf50' },
  depotCount: { textAlign: 'center', color: '#b0b0b0' },
  divider: { marginVertical: 10, backgroundColor: '#4a4a4a', height: 1 },
  depotCard: { marginVertical: 5, backgroundColor: '#3c3c3c', borderRadius: 8, padding: 8 },
  depotLieu: { fontSize: 18, fontWeight: 'bold', color: '#4caf50' },
  depotInfo: { fontSize: 16, color: '#e0e0e0' },
  depotNumero: { fontSize: 16, color: '#e0e0e0' },
  seeMoreButton: { marginTop: 10, alignSelf: 'center', borderColor: '#4caf50' },
});

export default TourneesScreen;
