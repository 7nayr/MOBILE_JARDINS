import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, ScrollView } from 'react-native';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { Polyline } from '@react-google-maps/api';
import { collection, getDocs, getDoc, doc, GeoPoint } from 'firebase/firestore';
import { db } from '../firebase/config';

// 🔹 Interfaces
interface Depot {
    id: string;
    lieu: string;
    coordonnes?: GeoPoint;
}

interface Tournee {
    id: string;
    nom: string;
    points_depots: string[];
}

// 🔹 Clé API Google Maps
const GOOGLE_MAPS_API_KEY = "AIzaSyCf2igaoyY9Be4tUdFf71mFPJ1Z0baQ3P8";  // Mets ta clé API ici

const MapDepot: React.FC = () => {
    const [selectedTournee, setSelectedTournee] = useState<string | null>(null);
    const [tournees, setTournees] = useState<Tournee[]>([]);
    const [depots, setDepots] = useState<Depot[]>([]);
    const [route, setRoute] = useState<{ lat: number, lng: number }[]>([]);
    const [isTourneeModalVisible, setTourneeModalVisible] = useState(false);
    const [isAdressesModalVisible, setAdressesModalVisible] = useState(false);

    // 🔹 Récupérer les tournées depuis Firestore
    useEffect(() => {
        const fetchTournees = async () => {
            const querySnapshot = await getDocs(collection(db, 'tournees'));
            const tourneeList: Tournee[] = querySnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Tournee));
            setTournees(tourneeList);
        };
        fetchTournees();
    }, []);

    // 🔹 Récupérer les dépôts d'une tournée sélectionnée
    useEffect(() => {
        if (!selectedTournee) return;

        const fetchDepots = async () => {
            const tourneeRef = doc(db, "tournees", selectedTournee);
            const tourneeSnap = await getDoc(tourneeRef);

            if (tourneeSnap.exists()) {
                const depotsIds: string[] = tourneeSnap.data().points_depots;
                
                const depotsData = (await Promise.all(
                    depotsIds.map(async (depotId) => {
                        const depotRef = doc(db, "points_depots", depotId);
                        const depotSnap = await getDoc(depotRef);
                        if (depotSnap.exists()) {
                            return { id: depotSnap.id, lieu: depotSnap.data().lieu, coordonnes: depotSnap.data().coordonnes };
                        }
                        return null;
                    })
                )).filter(depot => depot !== null) as Depot[];

                const orderedDepots = depotsIds
                    .map(id => depotsData.find(depot => depot.id === id))
                    .filter(depot => depot !== undefined) as Depot[];

                setDepots(orderedDepots);
                
                // 🔹 Générer la route dans le bon ordre
                const newRoute = orderedDepots.map(depot => ({
                    lat: depot.coordonnes!.latitude,
                    lng: depot.coordonnes!.longitude
                }));

                console.log("🛣️ Tracé des points de la tournée :", newRoute);
                setRoute(newRoute);
            }
        };

        fetchDepots();
    }, [selectedTournee]);

    return (
        <View style={styles.container}>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
                {/* 🔹 Sélectionner une tournée */}
                <TouchableOpacity style={styles.button} onPress={() => setTourneeModalVisible(true)}>
                    <Text style={styles.buttonText}>
                        {selectedTournee ? `Tournée sélectionnée : ${tournees.find(t => t.id === selectedTournee)?.nom}` : "Sélectionner une tournée"}
                    </Text>
                </TouchableOpacity>

                {/* 🔹 Voir les adresses des dépôts */}
                <TouchableOpacity style={styles.addressButton} onPress={() => setAdressesModalVisible(true)}>
                    <Text style={styles.buttonText}>Voir les adresses</Text>
                </TouchableOpacity>

                {/* 🔹 Carte Google Maps */}
                <Map
                    style={styles.map}
                    defaultCenter={{ lat: 48.1765, lng: 6.4508 }}
                    defaultZoom={12}
                >
                    {depots.map((depot, index) => (
                        depot.coordonnes && (
                            <Marker
                                key={depot.id}
                                position={{
                                    lat: depot.coordonnes.latitude,
                                    lng: depot.coordonnes.longitude
                                }}
                                title={`${index + 1}. ${depot.lieu}`}
                            />
                        )
                    ))}

                    {/* 🔹 Tracé de l'itinéraire */}
                    {route.length > 1 && (
                        <Polyline
                            path={route}
                            options={{
                                strokeColor: "#FF0000",
                                strokeOpacity: 1.0,
                                strokeWeight: 4
                            }}
                        />
                    )}
                </Map>
            </APIProvider>

            {/* 🔹 Modal de sélection des tournées */}
            <Modal visible={isTourneeModalVisible} animationType="slide" transparent>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setTourneeModalVisible(false)}>
                    <View style={styles.modalContainer}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>Sélectionnez une tournée</Text>
                            {tournees.map((tournee) => (
                                <TouchableOpacity key={tournee.id} style={styles.option} onPress={() => {
                                    setSelectedTournee(tournee.id);
                                    setTourneeModalVisible(false);
                                }}>
                                    <Text style={styles.optionText}>{tournee.nom}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* 🔹 Modal pour afficher les adresses des dépôts */}
            <Modal visible={isAdressesModalVisible} animationType="slide" transparent>
                <TouchableOpacity style={styles.modalOverlay} onPress={() => setAdressesModalVisible(false)}>
                    <View style={styles.modalContainer}>
                        <ScrollView>
                            <Text style={styles.modalTitle}>Adresses des dépôts</Text>
                            {depots.length > 0 ? (
                                depots.map((depot, index) => (
                                    <Text key={depot.id} style={styles.optionText}>
                                        {index + 1}. {depot.lieu}
                                    </Text>
                                ))
                            ) : (
                                <Text style={styles.optionText}>Aucune adresse disponible.</Text>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    map: {
        height: '100%',
        width: '100%',
    },
    button: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: 'black',
        padding: 10,
        borderRadius: 5,
        zIndex: 10,
    },
    addressButton: {
        position: 'absolute',
        top: 60,
        left: 10,
        backgroundColor: 'black',
        padding: 10,
        borderRadius: 5,
        zIndex: 10,
    },
    buttonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    modalContainer: {
        width: '80%',
        backgroundColor: 'white',
        padding: 20,
        borderRadius: 10,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 10,
    },
    option: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ddd',
    },
    optionText: {
        fontSize: 16,
    },
});

export default MapDepot;
