import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, ScrollView } from 'react-native';
// Import WebView pour afficher Google Maps
import { WebView } from 'react-native-webview';
import { collection, getDocs, getDoc, doc, GeoPoint } from 'firebase/firestore';
import { db } from '../firebase/config';

// Interfaces
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

interface LatLng {
  lat: number;
  lng: number;
}

interface RouteStep {
  instruction: string;
  distance: string;
  duration: string;
}

interface RouteInfo {
  totalDistance: string;
  totalDuration: string;
  steps: RouteStep[];
}

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = "AIzaSyCf2igaoyY9Be4tUdFf71mFPJ1Z0baQ3P8";

// Création d'une solution native pour React Native
const MapDepot: React.FC = () => {
  const [selectedTournee, setSelectedTournee] = useState<string | null>(null);
  const [tournees, setTournees] = useState<Tournee[]>([]);
  const [depots, setDepots] = useState<Depot[]>([]);
  const [route, setRoute] = useState<LatLng[]>([]);
  const [routeInfo, setRouteInfo] = useState<RouteInfo | null>(null);
  const [isTourneeModalVisible, setTourneeModalVisible] = useState(false);
  const [isAdressesModalVisible, setAdressesModalVisible] = useState(false);
  const [isItineraireModalVisible, setItineraireModalVisible] = useState(false);
  const [mapCenter, setMapCenter] = useState({ lat: 48.1765, lng: 6.4508 });
  const [mapZoom, setMapZoom] = useState(12);
  const [isLoading, setIsLoading] = useState(false);
  const [htmlContent, setHtmlContent] = useState('');
  const webViewRef = useRef<WebView>(null);
  
  // Récupérer les tournées de Firestore
  useEffect(() => {
    const fetchTournees = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'tournees'));
        const tourneeList: Tournee[] = querySnapshot.docs.map(docSnap => ({ 
          id: docSnap.id, 
          ...docSnap.data() 
        } as Tournee));
        setTournees(tourneeList);
      } catch (error) {
        console.error("Error fetching tournees:", error);
      }
    };
    
    fetchTournees();
  }, []);
  
  // Récupérer les dépôts pour la tournée sélectionnée
  useEffect(() => {
    // Réinitialiser les données lorsqu'une nouvelle tournée est sélectionnée
    if (!selectedTournee) {
      setDepots([]);
      setRoute([]);
      setRouteInfo(null);
      return;
    }
    
    const fetchDepots = async () => {
      try {
        setIsLoading(true);
        
        // Obtenir le document de tournée
        const tourneeRef = doc(db, "tournees", selectedTournee);
        const tourneeSnap = await getDoc(tourneeRef);
        
        if (!tourneeSnap.exists()) {
          setDepots([]);
          setRoute([]);
          setRouteInfo(null);
          setIsLoading(false);
          return;
        }
        
        // Obtenir les IDs de dépôt de la tournée
        const depotsIds: string[] = tourneeSnap.data().points_depots || [];
        
        if (depotsIds.length === 0) {
          setDepots([]);
          setRoute([]);
          setRouteInfo(null);
          setIsLoading(false);
          return;
        }
        
        // Récupérer tous les documents de dépôt
        const depotsData = (await Promise.all(
          depotsIds.map(async (depotId) => {
            try {
              const depotRef = doc(db, "points_depots", depotId);
              const depotSnap = await getDoc(depotRef);
              
              if (depotSnap.exists()) {
                return {
                  id: depotSnap.id,
                  lieu: depotSnap.data().lieu || "Sans nom",
                  coordonnes: depotSnap.data().coordonnes
                };
              }
            } catch (error) {
              console.error(`Erreur lors de la récupération du dépôt ${depotId}:`, error);
            }
            return null;
          })
        )).filter(depot => depot !== null) as Depot[];
        
        // Maintenir l'ordre spécifié dans points_depots
        const orderedDepots = depotsIds
          .map(id => depotsData.find(depot => depot.id === id))
          .filter(depot => depot !== undefined && depot.coordonnes) as Depot[];
        
        setDepots(orderedDepots);
        
        // Générer l'itinéraire dans le bon ordre
        const newRoute = orderedDepots
          .filter(depot => depot.coordonnes)
          .map(depot => ({
            lat: depot.coordonnes!.latitude,
            lng: depot.coordonnes!.longitude
          }));
        
        if (newRoute.length > 1) {
          // Calculer le centre de la carte
          let sumLat = 0;
          let sumLng = 0;
          
          newRoute.forEach(point => {
            sumLat += point.lat;
            sumLng += point.lng;
          });
          
          const center = {
            lat: sumLat / newRoute.length,
            lng: sumLng / newRoute.length
          };
          
          setMapCenter(center);
          
          // Ajuster le zoom en fonction du nombre de points
          setMapZoom(newRoute.length > 5 ? 11 : 13);
          
          // Mettre à jour l'itinéraire
          setRoute(newRoute);
          
          // Générer le contenu HTML pour WebView
          generateMapHtml(newRoute, center);
        } else {
          setRoute([]);
          setRouteInfo(null);
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des dépôts:", error);
        setDepots([]);
        setRoute([]);
        setRouteInfo(null);
        setIsLoading(false);
      }
    };
    
    fetchDepots();
  }, [selectedTournee]);
  
  // Générer le HTML pour la carte
  const generateMapHtml = (waypoints: LatLng[], center: LatLng) => {
    const waypointsString = JSON.stringify(waypoints);
    
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body, html, #map {
              height: 100%;
              margin: 0;
              padding: 0;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          
          <script>
            // Variables globales
            let map;
            let directionsService;
            let directionsRenderer;
            let markers = [];
            
            // Initialiser la carte
            function initMap() {
              const waypoints = ${waypointsString};
              const center = ${JSON.stringify(center)};
              
              // Créer la carte
              map = new google.maps.Map(document.getElementById('map'), {
                center: center,
                zoom: ${mapZoom},
                disableDefaultUI: false,
                gestureHandling: 'greedy'
              });
              
              // Créer le service de directions
              directionsService = new google.maps.DirectionsService();
              directionsRenderer = new google.maps.DirectionsRenderer({
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#FF0000',
                  strokeOpacity: 0.8,
                  strokeWeight: 5
                }
              });
              
              directionsRenderer.setMap(map);
              
              // Ajouter les marqueurs
              waypoints.forEach((point, index) => {
                const marker = new google.maps.Marker({
                  position: point,
                  map: map,
                  title: \`Arrêt \${index + 1}\`,
                  label: \`\${index + 1}\`
                });
                markers.push(marker);
              });
              
              // Calculer l'itinéraire
              calcRoute(waypoints);
              
              // Ajuster les limites pour voir tous les points
              const bounds = new google.maps.LatLngBounds();
              waypoints.forEach(point => {
                bounds.extend(point);
              });
              map.fitBounds(bounds);
            }
            
            // Calculer l'itinéraire
            function calcRoute(waypoints) {
              if (waypoints.length < 2) return;
              
              const origin = waypoints[0];
              const destination = waypoints[waypoints.length - 1];
              const middleWaypoints = waypoints.slice(1, waypoints.length - 1).map(point => ({
                location: new google.maps.LatLng(point.lat, point.lng),
                stopover: true
              }));
              
              const request = {
                origin: new google.maps.LatLng(origin.lat, origin.lng),
                destination: new google.maps.LatLng(destination.lat, destination.lng),
                waypoints: middleWaypoints,
                optimizeWaypoints: false,
                travelMode: google.maps.TravelMode.DRIVING
              };
              
              directionsService.route(request, (result, status) => {
                if (status === google.maps.DirectionsStatus.OK) {
                  directionsRenderer.setDirections(result);
                  
                  // Extraire les informations d'itinéraire
                  const route = result.routes[0];
                  if (route && route.legs) {
                    let totalDistance = 0;
                    let totalDuration = 0;
                    const allSteps = [];
                    
                    route.legs.forEach(leg => {
                      if (leg.distance) totalDistance += leg.distance.value;
                      if (leg.duration) totalDuration += leg.duration.value;
                      
                      if (leg.steps) {
                        leg.steps.forEach(step => {
                          if (step.instructions && step.distance && step.duration) {
                            allSteps.push({
                              instruction: step.instructions.replace(/<[^>]*>/g, ''),
                              distance: step.distance.text,
                              duration: step.duration.text
                            });
                          }
                        });
                      }
                    });
                    
                    // Formater la distance et la durée
                    const formatTotalDistance = totalDistance < 1000
                      ? \`\${totalDistance} m\`
                      : \`\${(totalDistance / 1000).toFixed(1)} km\`;
                      
                    const formatTotalDuration = totalDuration < 60
                      ? \`\${totalDuration} sec\`
                      : totalDuration < 3600
                        ? \`\${Math.floor(totalDuration / 60)} min\`
                        : \`\${Math.floor(totalDuration / 3600)} h \${Math.floor((totalDuration % 3600) / 60)} min\`;
                    
                    // Envoyer les infos à React Native
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                      type: 'routeInfo',
                      data: {
                        totalDistance: formatTotalDistance,
                        totalDuration: formatTotalDuration,
                        steps: allSteps
                      }
                    }));
                  }
                } else {
                  console.error("Erreur de calcul d'itinéraire:", status);
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'routeError',
                    error: status
                  }));
                }
              });
            }
          </script>
          
          <script async defer src="https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap"></script>
        </body>
      </html>
    `;
    
    setHtmlContent(html);
  };
  
  // Gestionnaire de messages de WebView
  const handleWebViewMessage = (event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      if (message.type === 'routeInfo') {
        setRouteInfo(message.data);
        setIsLoading(false);
      } else if (message.type === 'routeError') {
        console.error('Erreur de calcul d\'itineraire:', message.error);
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Erreur de traitement du message WebView:', error);
    }
  };
  
  return (
    <View style={styles.container}>
      {/* WebView pour Google Maps */}
      {htmlContent ? (
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleWebViewMessage}
          onError={(error) => console.error('WebView error:', error)}
        />
      ) : (
        <View style={styles.placeholderMap}>
          <Text>Sélectionnez une tournée pour afficher la carte</Text>
        </View>
      )}
      
      {/* Bouton pour sélectionner une tournée */}
      <TouchableOpacity 
        style={styles.button} 
        onPress={() => setTourneeModalVisible(true)}
      >
        <Text style={styles.buttonText}>
          {selectedTournee 
            ? `Tournée: ${tournees.find(t => t.id === selectedTournee)?.nom || ""}` 
            : "Sélectionner une tournée"
          }
        </Text>
      </TouchableOpacity>
      
      {/* Bouton pour voir les adresses des dépôts */}
      <TouchableOpacity 
        style={[styles.addressButton, !depots.length && styles.disabledButton]}
        onPress={() => setAdressesModalVisible(true)}
        disabled={!depots.length}
      >
        <Text style={styles.buttonText}>Voir les adresses</Text>
      </TouchableOpacity>
      
      {/* Bouton pour voir l'itinéraire détaillé */}
      <TouchableOpacity 
        style={[styles.itineraireButton, !routeInfo && styles.disabledButton]}
        onPress={() => {
          if (routeInfo) setItineraireModalVisible(true);
        }}
        disabled={!routeInfo}
      >
        <Text style={styles.buttonText}>Voir l'itinéraire</Text>
      </TouchableOpacity>
      
      {/* Indicateur de chargement */}
      {isLoading && (
        <View style={styles.loadingIndicator}>
          <Text style={styles.loadingText}>Chargement de l'itinéraire...</Text>
        </View>
      )}
      
      {/* Modal pour la sélection de tournée */}
      <Modal
        visible={isTourneeModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setTourneeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Sélectionnez une tournée</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setTourneeModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {tournees.length > 0 ? (
                tournees.map((tournee) => (
                  <TouchableOpacity
                    key={tournee.id}
                    style={styles.option}
                    onPress={() => {
                      setSelectedTournee(tournee.id);
                      setTourneeModalVisible(false);
                    }}
                  >
                    <Text style={styles.optionText}>{tournee.nom}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text>Aucune tournée disponible.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Modal pour afficher les adresses des dépôts */}
      <Modal
        visible={isAdressesModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAdressesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Adresses des dépôts</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setAdressesModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {depots.length > 0 ? (
                depots.map((depot, index) => (
                  <View key={depot.id} style={styles.option}>
                    <Text style={styles.optionText}>
                      {index + 1}. {depot.lieu}
                    </Text>
                  </View>
                ))
              ) : (
                <Text>Aucune adresse disponible.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      
      {/* Modal pour afficher l'itinéraire détaillé */}
      <Modal
        visible={isItineraireModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setItineraireModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Instructions d'itinéraire</Text>
              <TouchableOpacity 
                style={styles.closeButton}
                onPress={() => setItineraireModalVisible(false)}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              {routeInfo ? (
                <View>
                  <View style={styles.summaryContainer}>
                    <Text style={styles.summaryText}>
                      Distance totale: {routeInfo.totalDistance}
                    </Text>
                    <Text style={styles.summaryText}>
                      Durée estimée: {routeInfo.totalDuration}
                    </Text>
                  </View>
                  
                  <Text style={styles.sectionTitle}>Étapes:</Text>
                  {routeInfo.steps.map((step, index) => (
                    <View key={index} style={styles.stepContainer}>
                      <Text style={styles.stepInstruction}>
                        {step.instruction}
                      </Text>
                      <View style={styles.stepDetailsContainer}>
                        <Text style={styles.stepDetails}>{step.distance}</Text>
                        <Text style={styles.stepDetails}>{step.duration}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text>Aucun itinéraire disponible.</Text>
              )}
            </ScrollView>
          </View>
        </View>
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
  placeholderMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  button: {
    position: 'absolute',
    top: 50, // Ajustez cette valeur pour descendre le bouton
    left: 10,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
    minWidth: 180,
  },
  addressButton: {
    position: 'absolute',
    top: 100, // Ajustez cette valeur pour descendre le bouton
    left: 10,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
  },
  itineraireButton: {
    position: 'absolute',
    top: 150, // Ajustez cette valeur pour descendre le bouton
    left: 10,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
  },
  disabledButton: {
    backgroundColor: '#aaaaaa',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    borderRadius: 5,
    zIndex: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 14,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 10,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  closeButton: {
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#f0f0f0',
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#555',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 5,
  },
  option: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  optionText: {
    fontSize: 16,
  },
  summaryContainer: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 5,
    marginVertical: 10,
  },
  summaryText: {
    fontSize: 16,
    marginBottom: 5,
  },
  stepContainer: {
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingVertical: 10,
  },
  stepInstruction: {
    fontSize: 15,
    marginBottom: 5,
  },
  stepDetailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepDetails: {
    color: '#666',
    fontSize: 14,
  },
});

export default MapDepot;