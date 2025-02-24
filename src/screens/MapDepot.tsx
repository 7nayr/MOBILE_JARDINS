import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Modal, ScrollView } from 'react-native';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
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

// DirectionsRenderer Component - Optimized to prevent disappearing routes
const DirectionsRenderer: React.FC<{
  waypoints: LatLng[],
  onRouteInfoUpdate: (routeInfo: RouteInfo) => void
}> = ({ waypoints, onRouteInfoUpdate }) => {
  const map = useMap();
  const directionsRendererRef = useRef<google.maps.DirectionsRenderer | null>(null);
  const directionsServiceRef = useRef<google.maps.DirectionsService | null>(null);
  const lastWaypointsRef = useRef<string>("");
  
  useEffect(() => {
    // Initialize directions service once
    if (!directionsServiceRef.current) {
      directionsServiceRef.current = new google.maps.DirectionsService();
    }
    
    // Initialize renderer only once
    if (!directionsRendererRef.current && map) {
      directionsRendererRef.current = new google.maps.DirectionsRenderer({
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#FF0000',
          strokeOpacity: 0.8,
          strokeWeight: 5
        }
      });
      directionsRendererRef.current.setMap(map);
    }
    
    // Cleanup function
    return () => {
      if (directionsRendererRef.current) {
        directionsRendererRef.current.setMap(null);
        directionsRendererRef.current = null;
      }
    };
  }, [map]);
  
  useEffect(() => {
    // Skip if map not ready or not enough waypoints
    if (!map || !directionsRendererRef.current || !directionsServiceRef.current || waypoints.length < 2) {
      console.log("⚠️ Cannot render directions: map or waypoints not ready");
      return;
    }
    
    // Convert waypoints to string for comparison to avoid unnecessary re-renders
    const waypointsString = JSON.stringify(waypoints);
    
    // Skip if waypoints haven't changed
    if (waypointsString === lastWaypointsRef.current) {
      console.log("🔄 Skipping direction calculation, waypoints unchanged");
      return;
    }
    
    // Update last waypoints reference
    lastWaypointsRef.current = waypointsString;
    
    console.log("🔍 Calculating route with waypoints:", waypoints);
    
    // Prepare directions request
    const origin = waypoints[0];
    const destination = waypoints[waypoints.length - 1];
    const middleWaypoints = waypoints.slice(1, waypoints.length - 1).map(point => ({
      location: new google.maps.LatLng(point.lat, point.lng),
      stopover: true
    }));
    
    const request: google.maps.DirectionsRequest = {
      origin: new google.maps.LatLng(origin.lat, origin.lng),
      destination: new google.maps.LatLng(destination.lat, destination.lng),
      waypoints: middleWaypoints,
      optimizeWaypoints: false,
      travelMode: google.maps.TravelMode.DRIVING
    };
    
    // Request directions
    directionsServiceRef.current.route(request, (result, status) => {
      if (status === google.maps.DirectionsStatus.OK && result) {
        console.log("🛣️ Route calculated successfully");
        
        // Ensure the renderer is still available and set on the map
        if (directionsRendererRef.current) {
          directionsRendererRef.current.setMap(map);
          directionsRendererRef.current.setDirections(result);
        } else {
          console.error("⚠️ DirectionsRenderer not available");
        }
        
        // Process route information
        const route = result.routes[0];
        if (route && route.legs) {
          let totalDistance = 0;
          let totalDuration = 0;
          const allSteps: RouteStep[] = [];
          
          // Process each leg of the route
          route.legs.forEach(leg => {
            if (leg.distance) totalDistance += leg.distance.value;
            if (leg.duration) totalDuration += leg.duration.value;
            
            // Get detailed steps
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
          
          // Format total distance and duration
          const formatTotalDistance = totalDistance < 1000
            ? `${totalDistance} m`
            : `${(totalDistance / 1000).toFixed(1)} km`;
            
          const formatTotalDuration = totalDuration < 60
            ? `${totalDuration} sec`
            : totalDuration < 3600
              ? `${Math.floor(totalDuration / 60)} min`
              : `${Math.floor(totalDuration / 3600)} h ${Math.floor((totalDuration % 3600) / 60)} min`;
          
          // Update route information
          onRouteInfoUpdate({
            totalDistance: formatTotalDistance,
            totalDuration: formatTotalDuration,
            steps: allSteps
          });
        }
      } else {
        console.error("❌ Error calculating route:", status);
        
        // Reset route information on failure
        onRouteInfoUpdate({
          totalDistance: "Non disponible",
          totalDuration: "Non disponible",
          steps: []
        });
      }
    });
  }, [map, waypoints, onRouteInfoUpdate]);
  
  return null;
};

// Map Adjuster Component - Optimized to prevent excessive rerendering
const MapAdjuster: React.FC<{points: LatLng[]}> = ({ points }) => {
  const map = useMap();
  const processedPointsRef = useRef<string>("");
  
  useEffect(() => {
    if (!map || points.length <= 1) return;
    
    // Convert points to string for comparison
    const pointsString = JSON.stringify(points);
    
    // Skip if points haven't changed
    if (pointsString === processedPointsRef.current) {
      return;
    }
    
    // Update processed points reference
    processedPointsRef.current = pointsString;
    
    // Create bounds to include all points
    const bounds = new google.maps.LatLngBounds();
    points.forEach(point => {
      bounds.extend(point);
    });
    
    // Adjust map to show all points
    map.fitBounds(bounds);
    
    // Add some margin (zoom out slightly)
    const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
      const currentZoom = map.getZoom();
      if (currentZoom !== undefined) {
        const newZoom = Math.max(Math.min(currentZoom - 1, 17), 10);
        map.setZoom(newZoom);
      }
    });
    
    return () => {
      google.maps.event.removeListener(listener);
    };
  }, [map, points]);
  
  return null;
};

// Main Map Component
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
  
  // Memoized route info handler to prevent recreating on each render
  const handleRouteInfoUpdate = useCallback((info: RouteInfo) => {
    console.log("📌 Route information updated:", info);
    setRouteInfo(info);
  }, []);
  
  // Fetch tournees from Firestore
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
  
  // Fetch depots for selected tournee
  useEffect(() => {
    // Reset data when new tournee is selected
    if (!selectedTournee) {
      setDepots([]);
      setRoute([]);
      setRouteInfo(null);
      return;
    }
    
    const fetchDepots = async () => {
      try {
        console.log(`📍 Fetching depots for tournee: ${selectedTournee}`);
        
        // Get tournee document
        const tourneeRef = doc(db, "tournees", selectedTournee);
        const tourneeSnap = await getDoc(tourneeRef);
        
        if (!tourneeSnap.exists()) {
          console.log("Tournee does not exist");
          setDepots([]);
          setRoute([]);
          setRouteInfo(null);
          return;
        }
        
        // Get depot IDs from tournee
        const depotsIds: string[] = tourneeSnap.data().points_depots || [];
        
        if (depotsIds.length === 0) {
          console.log("📍 No depots found for this tournee");
          setDepots([]);
          setRoute([]);
          setRouteInfo(null);
          return;
        }
        
        // Fetch all depot documents
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
              console.error(`Error fetching depot ${depotId}:`, error);
            }
            return null;
          })
        )).filter(depot => depot !== null) as Depot[];
        
        // Maintain order specified in points_depots
        const orderedDepots = depotsIds
          .map(id => depotsData.find(depot => depot.id === id))
          .filter(depot => depot !== undefined && depot.coordonnes) as Depot[];
        
        console.log(`📍 ${orderedDepots.length} depots retrieved`);
        setDepots(orderedDepots);
        
        // Generate route in correct order
        const newRoute = orderedDepots
          .filter(depot => depot.coordonnes)
          .map(depot => ({
            lat: depot.coordonnes!.latitude,
            lng: depot.coordonnes!.longitude
          }));
        
        console.log("🛣️ Route points for calculation:", newRoute);
        
        if (newRoute.length > 1) {
          // Calculate map center
          let sumLat = 0;
          let sumLng = 0;
          
          newRoute.forEach(point => {
            sumLat += point.lat;
            sumLng += point.lng;
          });
          
          setMapCenter({
            lat: sumLat / newRoute.length,
            lng: sumLng / newRoute.length
          });
          
          // Adjust zoom based on number of points
          setMapZoom(newRoute.length > 5 ? 11 : 13);
          
          // Update route last to trigger rendering
          setRoute(newRoute);
        } else {
          console.log("⚠️ Not enough points to calculate a route");
          setRoute([]);
          setRouteInfo(null);
        }
      } catch (error) {
        console.error("Error fetching depots:", error);
        setDepots([]);
        setRoute([]);
        setRouteInfo(null);
      }
    };
    
    fetchDepots();
  }, [selectedTournee]);
  
  return (
    <View style={styles.container}>
      {/* Google Maps API Provider */}
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
        {/* Map Component */}
        <Map
          style={styles.map}
          defaultCenter={mapCenter}
          defaultZoom={mapZoom}
          center={mapCenter}
          zoom={mapZoom}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
        >
          {/* Adjust map to show all points */}
          {route.length > 1 && <MapAdjuster points={route} />}
          
          {/* Route rendering with directions */}
          {route.length > 1 && (
            <DirectionsRenderer 
              waypoints={route} 
              onRouteInfoUpdate={handleRouteInfoUpdate} 
            />
          )}
          
          {/* Markers for each depot */}
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
        </Map>
      </APIProvider>
      
      {/* Button to select a tournee */}
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
      
      {/* Button to view depot addresses */}
      <TouchableOpacity 
        style={styles.addressButton}
        onPress={() => setAdressesModalVisible(true)}
      >
        <Text style={styles.buttonText}>Voir les adresses</Text>
      </TouchableOpacity>
      
      {/* Button to view detailed route */}
      <TouchableOpacity 
        style={{
          ...styles.itineraireButton,
          backgroundColor: routeInfo ? 'black' : '#aaaaaa'
        }}
        onPress={() => {
          if (routeInfo) setItineraireModalVisible(true);
        }}
        disabled={!routeInfo}
      >
        <Text style={styles.buttonText}>Voir l'itinéraire</Text>
      </TouchableOpacity>
      
      {/* Modal for tournee selection */}
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
      
      {/* Modal for displaying depot addresses */}
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
      
      {/* Modal for displaying detailed route */}
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
  button: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'black',
    padding: 10,
    borderRadius: 5,
    zIndex: 10,
    minWidth: 180,
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
  itineraireButton: {
    position: 'absolute',
    top: 110,
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