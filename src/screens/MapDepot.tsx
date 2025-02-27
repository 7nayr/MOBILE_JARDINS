import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, ScrollView, ActivityIndicator, Platform, SafeAreaView } from 'react-native';
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
  const [webViewReady, setWebViewReady] = useState(false);
  const [webViewSupported, setWebViewSupported] = useState(true);
  const [webViewKey, setWebViewKey] = useState(0); // Used to force WebView refresh when needed
  const [webViewError, setWebViewError] = useState<string | null>(null);
  
  const webViewRef = useRef<WebView>(null);
  const depotsRef = useRef<Depot[]>([]);
  const routeRef = useRef<LatLng[]>([]);
  
  // Vérifier si WebView est supporté sur la plateforme actuelle
  useEffect(() => {
    if (Platform.OS === 'web') {
      setWebViewSupported(false);
    }
  }, []);
  
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
    if (!selectedTournee) {
      setDepots([]);
      setRoute([]);
      setRouteInfo(null);
      depotsRef.current = [];
      routeRef.current = [];
      return;
    }
    
    const fetchDepots = async () => {
      try {
        setIsLoading(true);
        setWebViewError(null);
        
        // Obtenir le document de tournée
        const tourneeRef = doc(db, "tournees", selectedTournee);
        const tourneeSnap = await getDoc(tourneeRef);
        
        if (!tourneeSnap.exists()) {
          setDepots([]);
          setRoute([]);
          setRouteInfo(null);
          setIsLoading(false);
          depotsRef.current = [];
          routeRef.current = [];
          return;
        }
        
        // Obtenir les IDs de dépôt de la tournée
        const depotsIds: string[] = tourneeSnap.data().points_depots || [];
        
        if (depotsIds.length === 0) {
          setDepots([]);
          setRoute([]);
          setRouteInfo(null);
          setIsLoading(false);
          depotsRef.current = [];
          routeRef.current = [];
          return;
        }
        
        // Récupérer tous les documents de dépôt
        const depotsPromises = depotsIds.map(async (depotId) => {
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
        });
        
        const depotsData = (await Promise.all(depotsPromises)).filter(depot => depot !== null) as Depot[];
        
        // Maintenir l'ordre spécifié dans points_depots
        const orderedDepots = depotsIds
          .map(id => depotsData.find(depot => depot.id === id))
          .filter(depot => depot !== undefined && depot.coordonnes) as Depot[];
        
        setDepots(orderedDepots);
        depotsRef.current = orderedDepots;
        
        // Générer l'itinéraire dans le bon ordre
        const newRoute = orderedDepots
          .filter(depot => depot.coordonnes)
          .map(depot => ({
            lat: depot.coordonnes!.latitude,
            lng: depot.coordonnes!.longitude
          }));
        
        setRoute(newRoute);
        routeRef.current = newRoute;
        
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
          
          // Forcer le rechargement de WebView uniquement lorsque nécessaire
          if (webViewReady) {
            setWebViewKey(prev => prev + 1);
          }
        } else {
          setIsLoading(false);
        }
        
        if (!webViewSupported) {
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Erreur lors de la récupération des dépôts:", error);
        setDepots([]);
        setRoute([]);
        setRouteInfo(null);
        setIsLoading(false);
        setWebViewError("Erreur de chargement des données");
      }
    };
    
    fetchDepots();
  }, [selectedTournee, webViewSupported]);
  
  // Générer le HTML pour la carte
  const generateMapHtml = useCallback((waypoints: LatLng[], center: LatLng, zoom: number) => {
    const waypointsString = JSON.stringify(waypoints);
    const centerString = JSON.stringify(center);
    
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <style>
            body, html, #map {
              height: 100%;
              margin: 0;
              padding: 0;
              font-family: Arial, sans-serif;
            }
            #error {
              position: absolute;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              background-color: rgba(255, 0, 0, 0.7);
              color: white;
              padding: 15px;
              border-radius: 5px;
              z-index: 1000;
              display: none;
            }
          </style>
        </head>
        <body>
          <div id="map"></div>
          <div id="error"></div>
          
          <script>
            // Variables globales
            let map;
            let directionsService;
            let directionsRenderer;
            let markers = [];
            let waypoints = ${waypointsString};
            let center = ${centerString};
            
            // Log des erreurs
            window.onerror = function(message, source, lineno, colno, error) {
              try {
                const errorDiv = document.getElementById('error');
                errorDiv.innerHTML = 'Erreur: ' + message;
                errorDiv.style.display = 'block';
                
                // Envoyer l'erreur à React Native
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'jsError',
                    data: { message, source, lineno, colno }
                  }));
                }
              } catch (e) {
                // Éviter les erreurs en cascade
                console.error("Erreur dans le gestionnaire d'erreurs:", e);
              }
              return true;
            };
            
            // Prévenir React Native que le WebView est prêt
            function sendReadySignal() {
              try {
                if (window.ReactNativeWebView) {
                  window.ReactNativeWebView.postMessage(JSON.stringify({
                    type: 'webviewReady'
                  }));
                }
              } catch (e) {
                console.error("Erreur lors de l'envoi du signal ready:", e);
              }
            }
            
            // Initialiser la carte
            function initMap() {
              try {
                // Créer la carte
                map = new google.maps.Map(document.getElementById('map'), {
                  center: center,
                  zoom: ${zoom},
                  disableDefaultUI: false,
                  gestureHandling: 'greedy'
                });
                
                // Confirmer que la carte est chargée
                google.maps.event.addListenerOnce(map, 'idle', function() {
                  sendReadySignal();
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
                
                // Calculer l'itinéraire si au moins 2 points
                if (waypoints.length >= 2) {
                  calcRoute(waypoints);
                  
                  // Ajuster les limites pour voir tous les points
                  const bounds = new google.maps.LatLngBounds();
                  waypoints.forEach(point => {
                    bounds.extend(point);
                  });
                  map.fitBounds(bounds);
                } else {
                  sendReadySignal();
                }
              } catch (e) {
                console.error("Erreur dans initMap:", e);
                window.onerror(e.message, 'initMap', 0, 0, e);
              }
            }
            
            // Calculer l'itinéraire
            function calcRoute(waypoints) {
              if (waypoints.length < 2) {
                sendReadySignal();
                return;
              }
              
              try {
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
                      if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                          type: 'routeInfo',
                          data: {
                            totalDistance: formatTotalDistance,
                            totalDuration: formatTotalDuration,
                            steps: allSteps
                          }
                        }));
                      }
                    }
                  } else {
                    console.error("Erreur de calcul d'itinéraire:", status);
                    if (window.ReactNativeWebView) {
                      window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'routeError',
                        error: status
                      }));
                    }
                  }
                });
              } catch (e) {
                console.error("Erreur dans calcRoute:", e);
                window.onerror(e.message, 'calcRoute', 0, 0, e);
              }
            }
            
            // Exécuter une fonction après un certain délai
            function executeWithTimeout(fn, timeout) {
              return new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                  reject(new Error('Timeout'));
                }, timeout);
                
                try {
                  fn();
                  clearTimeout(timeoutId);
                  resolve();
                } catch (error) {
                  clearTimeout(timeoutId);
                  reject(error);
                }
              });
            }
            
            // Charger l'API Google Maps
            document.addEventListener('DOMContentLoaded', function() {
              try {
                // Vérifie si Google Maps API est déjà chargé
                if (window.google && window.google.maps) {
                  initMap();
                } else {
                  const script = document.createElement('script');
                  script.src = \`https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&callback=initMap\`;
                  script.async = true;
                  script.defer = true;
                  script.onerror = function() {
                    window.onerror("Failed to load Google Maps API", "script", 0, 0, new Error("API load error"));
                  };
                  document.head.appendChild(script);
                }
              } catch (e) {
                console.error("Erreur lors du chargement de l'API:", e);
                window.onerror(e.message, 'DOMContentLoaded', 0, 0, e);
              }
            });
            
            // Envoyer un signal si le chargement prend trop de temps
            setTimeout(function() {
              if (!map) {
                console.warn("La carte n'a pas été initialisée après 5 secondes");
                sendReadySignal();
              }
            }, 5000);
          </script>
        </body>
      </html>
    `;
  }, []);
  
  // HTML Mémorisé pour éviter des calculs inutiles
  const mapHtml = useMemo(() => {
    if (!route.length) return '';
    return generateMapHtml(route, mapCenter, mapZoom);
  }, [route, mapCenter, mapZoom, generateMapHtml]);
  
  // Gestionnaire de messages de WebView
  const handleWebViewMessage = useCallback((event: any) => {
    try {
      const message = JSON.parse(event.nativeEvent.data);
      
      switch (message.type) {
        case 'webviewReady':
          setWebViewReady(true);
          break;
        case 'routeInfo':
          setRouteInfo(message.data);
          setIsLoading(false);
          break;
        case 'routeError':
          console.error('Erreur de calcul d\'itineraire:', message.error);
          setIsLoading(false);
          setWebViewError(`Erreur d'itinéraire: ${message.error}`);
          break;
        case 'jsError':
          console.error('Erreur JavaScript dans WebView:', message.data);
          setWebViewError(`Erreur JS: ${message.data.message}`);
          setIsLoading(false);
          break;
        default:
          console.log('Message inconnu du WebView:', message);
      }
    } catch (error) {
      console.error('Erreur de traitement du message WebView:', error);
      setIsLoading(false);
    }
  }, []);
  
  // Sélectionner une tournée
  const handleSelectTournee = useCallback((tourneeId: string) => {
    setSelectedTournee(tourneeId);
    setRouteInfo(null);
    setWebViewReady(false);
    setTourneeModalVisible(false);
  }, []);
  
  // Gérer les erreurs WebView
  interface WebViewErrorEvent {
    description?: string;
    code?: number;
    url?: string;
    domain?: string;
  }

  interface WebViewErrorSyntheticEvent {
    nativeEvent: WebViewErrorEvent;
  }

  const handleWebViewError = useCallback((syntheticEvent: WebViewErrorSyntheticEvent) => {
    const { nativeEvent } = syntheticEvent;
    console.error('WebView error:', nativeEvent);
    setWebViewError(`Erreur WebView: ${nativeEvent.description || 'Erreur inconnue'}`);
    setIsLoading(false);
  }, []);
  
  // Afficher un message d'erreur si WebView n'est pas supporté
  if (!webViewSupported) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.placeholderMap}>
          <Text style={styles.errorText}>
            WebView n'est pas pris en charge sur cette plateforme.
            Veuillez utiliser une plateforme compatible (iOS/Android).
          </Text>
        </View>
        
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
      </SafeAreaView>
    );
  }
  
  return (
    <SafeAreaView style={styles.container}>
      {/* WebView pour Google Maps */}
      {route.length > 0 ? (
        <WebView
          key={webViewKey} // Utiliser une clé unique pour forcer le rechargement
          ref={webViewRef}
          source={{ html: mapHtml }}
          style={styles.map}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onMessage={handleWebViewMessage}
          onError={handleWebViewError}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('WebView HTTP error:', nativeEvent);
          }}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.webviewLoader}>
              <ActivityIndicator size="large" color="#000" />
              <Text style={styles.loadingText}>Chargement de la carte...</Text>
            </View>
          )}
          onLoadEnd={() => {
            if (!webViewReady) {
              // Si après 10 secondes le WebView n'a pas signalé qu'il est prêt, considérer comme chargé
              setTimeout(() => {
                setWebViewReady(true);
                setIsLoading(false);
              }, 10000);
            }
          }}
        />
      ) : (
        <View style={styles.placeholderMap}>
          <Text style={styles.placeholderText}>
            {selectedTournee ? "Chargement de la carte..." : "Sélectionnez une tournée pour afficher la carte"}
          </Text>
          {isLoading && <ActivityIndicator size="large" color="#000" />}
        </View>
      )}
      
      {/* Affichage des erreurs */}
      {webViewError && (
        <View style={styles.errorOverlay}>
          <Text style={styles.errorText}>{webViewError}</Text>
          <TouchableOpacity 
            style={styles.errorButton} 
            onPress={() => {
              setWebViewError(null);
              setWebViewKey(prev => prev + 1); // Forcer le rechargement
            }}
          >
            <Text style={styles.errorButtonText}>Réessayer</Text>
          </TouchableOpacity>
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
          <ActivityIndicator size="small" color="#FFF" />
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
                    style={[
                      styles.option,
                      selectedTournee === tournee.id && styles.selectedOption
                    ]}
                    onPress={() => handleSelectTournee(tournee.id)}
                  >
                    <Text 
                      style={[
                        styles.optionText,
                        selectedTournee === tournee.id && styles.selectedOptionText
                      ]}
                    >
                      {tournee.nom}
                    </Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.noDataText}>Aucune tournée disponible.</Text>
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
                <Text style={styles.noDataText}>Aucune adresse disponible.</Text>
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
                <Text style={styles.noDataText}>Aucun itinéraire disponible.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  map: {
    height: '100%',
    width: '100%',
    flex: 1,
  },
  webviewLoader: {
    position: 'absolute',
    height: '100%',
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  placeholderText: {
    fontSize: 16,
    marginBottom: 10,
    textAlign: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    color: 'white',
    textAlign: 'center',
    padding: 10,
  },
  errorOverlay: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    transform: [{ translateY: -50 }],
    backgroundColor: 'rgba(220, 0, 0, 0.8)',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    zIndex: 1000,
  },
  errorButton: {
    marginTop: 10,
    backgroundColor: 'white',
    padding: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  errorButtonText: {
    color: 'black',
    fontWeight: 'bold',
  },
  noDataText: {
    padding: 15,
    fontSize: 16,
    color: '#666',
  },
  button: {
    position: 'absolute',
    top: 50,
    left: 10,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
    minWidth: 200,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  addressButton: {
    position: 'absolute',
    top: 100,
    left: 10,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  itineraireButton: {
    position: 'absolute',
    top: 150,
    left: 10,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
    minWidth: 150,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  disabledButton: {
    backgroundColor: '#aaaaaa',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  loadingIndicator: {
    position: 'absolute',
    bottom: 20,
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 20,
  },
  loadingText: {
    color: 'white',
    fontSize: 14,
    marginLeft: 10,
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
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  selectedOption: {
    backgroundColor: '#f0f0f0',
    borderLeftWidth: 3,
    borderLeftColor: 'black',
  },
  optionText: {
    fontSize: 16,
  },
  selectedOptionText: {
    fontWeight: 'bold',
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
    paddingVertical: 12,
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