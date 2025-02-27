import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform, ScrollView, FlatList } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { collection, getDocs, doc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Card, Title, Paragraph } from 'react-native-paper';

// Interface pour les points de dépôt
interface PointDepot {
  id: string;
  adresse: string;
  coordonnees: string;
  horaires: string;
  lieu: string;
  numeros_depot: string[];
}

// Interface pour les paniers
interface Panier {
  id: string;
  clientId: string;
  composition: string[];
  pointsDepot: string[];
  type: string;
  statut: string;
}

export default function QrCodeScannerScreen() {
  // Permissions et états de la caméra
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);
  
  // États pour les données
  const [pointsDepot, setPointsDepot] = useState<PointDepot[]>([]);
  const [loading, setLoading] = useState(true);
  const [foundDepot, setFoundDepot] = useState<PointDepot | null>(null);
  const [paniersFiltres, setPaniersFiltres] = useState<Panier[]>([]);
  const [debugInfo, setDebugInfo] = useState<string>(''); // Pour le débogage

  // Charger tous les points de dépôt depuis Firestore
  useEffect(() => {
    const fetchPointsDepot = async () => {
      try {
        setLoading(true);
        const querySnapshot = await getDocs(collection(db, 'points_depots'));
        const pointsDepotList: PointDepot[] = querySnapshot.docs.map((doc) => {
          const data = doc.data();
          // Assurer que numeros_depot est un tableau et contient des chaînes de caractères
          const numerosDepot = Array.isArray(data.numeros_depot) 
            ? data.numeros_depot.map(String) 
            : [];
            
          return {
            id: doc.id,
            ...data,
            numeros_depot: numerosDepot
          } as PointDepot;
        });

        console.log("🔥 Points de dépôt chargés :", pointsDepotList.length);
        // Log pour déboguer
        pointsDepotList.forEach(depot => {
          console.log(`Dépôt ${depot.id} (${depot.lieu}): numeros=${JSON.stringify(depot.numeros_depot)}`);
        });
        
        setPointsDepot(pointsDepotList);
      } catch (error) {
        console.error("❌ Erreur lors du chargement des points de dépôt :", error);
        Alert.alert("Erreur", "Impossible de charger les points de dépôt");
      } finally {
        setLoading(false);
      }
    };

    fetchPointsDepot();
  }, []);

  // Demander la permission de la caméra
  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  // Charger les paniers pour un point de dépôt spécifique
  const fetchPaniersPourDepot = async (depotId: string) => {
    try {
      const q = query(
        collection(db, "paniers"), 
        where("pointsDepot", "array-contains", depotId)
      );
      const querySnapshot = await getDocs(q);

      const panierList: Panier[] = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      } as Panier));

      setPaniersFiltres(panierList);
      console.log(`🚚 Paniers trouvés pour le dépôt ${depotId}: ${panierList.length}`);
    } catch (error) {
      console.error("❌ Erreur lors du chargement des paniers :", error);
      Alert.alert("Erreur", "Impossible de charger les paniers");
    }
  };

  // Cherche le point de dépôt correspondant au numéro scanné - FONCTION AMÉLIORÉE
  const findDepotByNumero = (numeroScan: string) => {
    // Normaliser le numéro scanné (supprimer les espaces et convertir en chaîne)
    const numeroScanNormalise = String(numeroScan).trim();
    
    console.log(`🔍 Recherche du dépôt pour le numéro: "${numeroScanNormalise}"`);
    
    // Récupérer la liste des dépôts et leurs numéros pour le débogage
    const depotInfo = pointsDepot.map(d => `${d.id} (${d.lieu}): [${d.numeros_depot?.join(', ')}]`).join('\n');
    setDebugInfo(`Numéro scanné: "${numeroScanNormalise}"\n\nDépôts disponibles:\n${depotInfo}`);
    
    // Recherche du dépôt avec une normalisation des numéros
    const depotTrouve = pointsDepot.find(depot => {
      if (!depot.numeros_depot || !Array.isArray(depot.numeros_depot)) {
        return false;
      }
      
      return depot.numeros_depot.some(num => {
        const numNormalise = String(num).trim();
        const match = numNormalise === numeroScanNormalise;
        console.log(`Comparaison: "${numNormalise}" vs "${numeroScanNormalise}" => ${match ? "✅" : "❌"}`);
        return match;
      });
    });

    if (depotTrouve) {
      console.log(`✅ Dépôt trouvé: ${depotTrouve.id} - ${depotTrouve.lieu}`);
      // Charger les paniers pour ce dépôt
      fetchPaniersPourDepot(depotTrouve.id);
      return depotTrouve;
    } else {
      console.log("❌ Aucun dépôt trouvé pour ce numéro");
      return null;
    }
  };

  // Capturer une photo pour scanner le QR code
  const takePicture = async () => {
    if (cameraRef.current) {
      setScanned(true);
      try {
        // Prendre une photo
        const photo = await cameraRef.current.takePictureAsync({ 
          quality: 0.8,
          exif: false 
        });
        
        // Redimensionner l'image pour un traitement plus rapide
        const manipResult = await ImageManipulator.manipulateAsync(
          photo.uri,
          [{ resize: { width: 400 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        // Traiter l'image pour détecter le QR code
        if (manipResult.base64) {
          if (Platform.OS === 'web') {
            await processQRCodeOnWeb(manipResult.base64);
          } else {
            // Pour les plateformes mobiles
            Alert.alert(
              "Information",
              "Décodage QR limité hors web. Utilisez un scanner externe ou l'application web."
            );
            setScanned(false);
          }
        } else {
          throw new Error("Données base64 nulles");
        }
      } catch (error) {
        console.error("Erreur lors de la capture d'image:", error);
        Alert.alert("Erreur", "Impossible de scanner le QR code. Réessayez.");
        setScanned(false);
      }
    } else {
      Alert.alert("Erreur", "Caméra non disponible");
      setScanned(false);
    }
  };

  // Traiter le QR code sur le web
  const processQRCodeOnWeb = async (base64Image: string): Promise<void> => {
    try {
      // Import dynamique de jsQR
      const jsQR = (await import('jsqr')).default;
      
      return new Promise((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            if (!ctx) {
              reject(new Error("Impossible de créer le contexte du canvas"));
              return;
            }
            
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height);
            
            if (code) {
              const scannedData = code.data.trim(); // Nettoyer les espaces
              setQrData(scannedData);
              console.log(`📱 QR Code scanné: "${scannedData}"`);
              
              // Rechercher le point de dépôt
              const depot = findDepotByNumero(scannedData);
              
              if (depot) {
                setFoundDepot(depot);
                Alert.alert("Point de dépôt trouvé", `QR code correspond à: ${depot.lieu}`);
              } else {
                setFoundDepot(null);
                Alert.alert("Résultat", `QR code scanné: ${scannedData}`, [
                  { text: "OK" },
                  { 
                    text: "Réessayer", 
                    onPress: () => {
                      setQrData(null);
                      setScanned(false);
                    }
                  }
                ]);
              }
              
              resolve();
            } else {
              Alert.alert("Aucun QR code détecté", "Veuillez réessayer");
              reject(new Error("Aucun QR code détecté"));
            }
          } catch (error) {
            reject(error);
          } finally {
            setScanned(false);
          }
        };
        
        img.onerror = (err) => {
          reject(err);
          setScanned(false);
        };
        
        img.src = `data:image/jpeg;base64,${base64Image}`;
      });
    } catch (error) {
      console.error("Erreur lors du décodage du QR code:", error);
      Alert.alert("Erreur", "Erreur lors du décodage du QR code");
      setScanned(false);
      throw error;
    }
  };

  // Entrée manuelle d'un code QR (fonctionnalité ajoutée)
  const handleManualInput = () => {
    Alert.prompt(
      "Entrer un numéro de dépôt",
      "Saisissez manuellement le numéro du point de dépôt",
      [
        {
          text: "Annuler",
          style: "cancel"
        },
        {
          text: "Rechercher",
          onPress: (numero?: string) => {
            if (numero) {
              setQrData(numero.trim());
              const depot = findDepotByNumero(numero.trim());
              setFoundDepot(depot);
              if (!depot) {
                Alert.alert("Résultat", `Aucun dépôt trouvé pour le numéro: ${numero}`);
              }
            }
          }
        }
      ],
      "plain-text"
    );
  };

  // Déclencher le scan
  const handleScan = () => {
    if (!scanned) {
      takePicture();
    }
  };

  // Réinitialiser le scan
  const resetScan = () => {
    setScanned(false);
    setQrData(null);
    setFoundDepot(null);
    setPaniersFiltres([]);
    setDebugInfo('');
  };

  // Afficher les paniers du dépôt
  const renderPaniers = () => {
    return (
      <View style={styles.paniersContainer}>
        <Text style={styles.paniersTitle}>🚚 Paniers du dépôt</Text>
        {paniersFiltres.length > 0 ? (
          <FlatList
            data={paniersFiltres}
            keyExtractor={(panier) => panier.id}
            renderItem={({ item: panier }) => (
              <Card style={styles.panierCard}>
                <Card.Content>
                  <Title style={styles.panierType}>{panier.type}</Title>
                  <Paragraph style={styles.panierText}>📦 {panier.composition.join(", ")}</Paragraph>
                  <Paragraph style={styles.panierStatus}>🔹 {panier.statut}</Paragraph>
                  <Paragraph style={styles.panierClient}>👤 Client : {panier.clientId}</Paragraph>
                </Card.Content>
              </Card>
            )}
          />
        ) : (
          <Text style={styles.noPaniersText}>Aucun panier trouvé pour ce dépôt</Text>
        )}
      </View>
    );
  };

  // Gestion des états de chargement et de permission
  if (!permission) {
    return <View style={styles.container}><Text style={styles.text}>Demande d'autorisation de la caméra...</Text></View>;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Pas d'accès à la caméra</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Demander l'accès</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.text}>Chargement des données...</Text>
      </View>
    );
  }

  // Rendu principal
  return (
    <View style={styles.container}>
      {!qrData ? (
        <>
          <CameraView
            ref={cameraRef}
            style={styles.camera}
            facing="back"
          />
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleScan} 
              disabled={scanned}
            >
              <Text style={styles.buttonText}>
                {scanned ? "Scan en cours..." : "Scanner un QR Code"}
              </Text>
            </TouchableOpacity>
            
            {/* Bouton d'entrée manuelle (nouvelle fonctionnalité) */}
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={handleManualInput}
            >
              <Text style={styles.buttonText}>Saisir un numéro manuellement</Text>
            </TouchableOpacity>
          </View>
          
          {Platform.OS !== 'web' && (
            <View style={styles.disclaimer}>
              <Text style={styles.disclaimerText}>
                Fonctionnalité de décodage QR limitée hors web
              </Text>
            </View>
          )}
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <Text style={styles.resultTitle}>QR Code scanné</Text>
          <Text style={styles.qrValue}>{qrData}</Text>
          
          {foundDepot ? (
            <>
              <Card style={styles.depotCard}>
                <Card.Content>
                  <Title style={styles.depotTitle}>Point de dépôt</Title>
                  <Paragraph style={styles.depotLieu}>{foundDepot.lieu}</Paragraph>
                  <Paragraph style={styles.depotInfo}>Adresse: {foundDepot.adresse}</Paragraph>
                  <Paragraph style={styles.depotInfo}>Horaires: {foundDepot.horaires}</Paragraph>
                  <View style={styles.depotNumeroContainer}>
                    <Text style={styles.depotNumeroLabel}>N° dépôt:</Text>
                    <Text style={styles.depotNumero}>
                      {foundDepot.numeros_depot?.join(", ") ?? "Non spécifié"}
                    </Text>
                  </View>
                </Card.Content>
              </Card>
              
              {renderPaniers()}
            </>
          ) : (
            <View style={styles.notFoundContainer}>
              <Text style={styles.notFoundText}>
                Aucun point de dépôt correspondant au numéro {qrData}
              </Text>
              
              {/* Informations de débogage */}
              {__DEV__ && debugInfo && (
                <View style={styles.debugContainer}>
                  <Text style={styles.debugTitle}>Informations de débogage:</Text>
                  <Text style={styles.debugText}>{debugInfo}</Text>
                </View>
              )}
            </View>
          )}
          
          <TouchableOpacity style={styles.button} onPress={resetScan}>
            <Text style={styles.buttonText}>Scanner un autre code</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
    justifyContent: 'center',
    alignItems: 'center',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  button: {
    backgroundColor: '#4caf50',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
    width: '80%',
  },
  secondaryButton: {
    backgroundColor: '#2196F3', // Bleu pour le bouton secondaire
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  text: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
    textAlign: 'center',
  },
  disclaimer: {
    position: 'absolute',
    top: 40,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 10,
    alignItems: 'center',
  },
  disclaimerText: {
    color: '#FFA500',
    fontSize: 12,
    textAlign: 'center',
  },
  resultContainer: {
    padding: 20,
    alignItems: 'center',
    width: '100%',
  },
  resultTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  qrValue: {
    fontSize: 18,
    color: '#4caf50',
    marginBottom: 20,
    padding: 10,
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  depotCard: {
    width: '100%',
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
    marginBottom: 20,
    elevation: 3,
  },
  depotTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 5,
  },
  depotLieu: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  depotInfo: {
    fontSize: 16,
    color: '#e0e0e0',
    marginBottom: 5,
  },
  depotNumeroContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  depotNumeroLabel: {
    fontSize: 16,
    color: '#b0b0b0',
    marginRight: 10,
  },
  depotNumero: {
    fontSize: 16,
    color: '#4caf50',
    fontWeight: 'bold',
  },
  notFoundContainer: {
    padding: 20,
    backgroundColor: 'rgba(255, 0, 0, 0.1)',
    borderRadius: 10,
    marginBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  notFoundText: {
    color: '#ff5252',
    fontSize: 16,
    textAlign: 'center',
  },
  debugContainer: {
    marginTop: 20,
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 5,
    width: '100%',
  },
  debugTitle: {
    color: '#FFA500',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  debugText: {
    color: '#b0b0b0',
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  paniersContainer: {
    width: '100%',
    marginTop: 20,
  },
  paniersTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#4caf50',
    marginBottom: 10,
    textAlign: 'center',
  },
  panierCard: {
    backgroundColor: '#2c2c2c',
    marginBottom: 10,
    borderRadius: 10,
  },
  panierType: {
    color: '#4caf50',
    fontSize: 18,
  },
  panierText: {
    color: '#e0e0e0',
  },
  panierStatus: {
    color: '#b0b0b0',
    fontStyle: 'italic',
  },
  panierClient: {
    color: '#e0e0e0',
    marginTop: 5,
  },
  noPaniersText: {
    color: '#ff5252',
    textAlign: 'center',
    fontSize: 16,
  }
});