import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Appbar, Card, Title, Paragraph, Divider } from 'react-native-paper';

// ✅ Définition des types
interface Panier {
  id: string;
  type: string;
  composition: string[];
  statut: string;
  tourneeId: string;
}

interface JourPanier {
  jour: string;
  paniers: Panier[];
}

const RecapPaniersScreen: React.FC = () => {
  const [paniersParJour, setPaniersParJour] = useState<JourPanier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPaniers = async () => {
      try {
        setLoading(true);
        console.log("🔄 Chargement des paniers...");

        const q = query(collection(db, "paniers"));
        const querySnapshot = await getDocs(q);

        const panierList: Panier[] = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Panier[];

        console.log("🔥 Paniers récupérés :", panierList);

        const jours: { [key: string]: Panier[] } = {};

        panierList.forEach((panier) => {
          if (!jours[panier.tourneeId]) {
            jours[panier.tourneeId] = [];
          }
          jours[panier.tourneeId].push(panier);
        });

        const formattedData = Object.keys(jours).map((jour) => ({
          jour,
          paniers: jours[jour],
        }));

        setPaniersParJour(formattedData);
      } catch (error) {
        console.error("❌ Erreur lors du chargement des paniers :", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPaniers();
  }, []);

  return (
    <View style={styles.container}>
      <Appbar.Header style={styles.appBar}>
        <Appbar.Content title="🛒 Récapitulatif des Paniers" titleStyle={styles.title} />
      </Appbar.Header>

      {loading ? (
        <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
      ) : (
        <FlatList
          data={paniersParJour}
          keyExtractor={(item) => item.jour}
          renderItem={({ item }) => (
            <View style={styles.section}>
              <Title style={styles.jourTitle}>📅 {item.jour}</Title>
              <FlatList
                data={item.paniers}
                keyExtractor={(panier) => panier.id}
                renderItem={({ item: panier }) => (
                  <Card style={styles.panierCard}>
                    <Card.Content>
                      <Title style={styles.panierType}>{panier.type}</Title>
                      <Paragraph style={styles.panierText}>📦 {panier.composition.join(", ")}</Paragraph>
                      <Paragraph style={styles.panierStatus}>🔹 {panier.statut}</Paragraph>
                    </Card.Content>
                  </Card>
                )}
              />
              <Divider style={styles.divider} />
            </View>
          )}
        />
      )}
    </View>
  );
};

// 🎨 **Styles**
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    paddingBottom: 10,
  },
  appBar: {
    backgroundColor: '#1B5E20',
  },
  title: {
    color: '#FFFFFF',
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
  },
  section: {
    padding: 15,
  },
  jourTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 10,
  },
  panierCard: {
    marginVertical: 8,
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 12,
    elevation: 5,
  },
  panierType: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#66BB6A',
  },
  panierText: {
    fontSize: 16,
    color: '#E0E0E0',
  },
  panierStatus: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFEB3B',
  },
  divider: {
    marginVertical: 12,
    backgroundColor: '#757575',
  },
});

export default RecapPaniersScreen;
