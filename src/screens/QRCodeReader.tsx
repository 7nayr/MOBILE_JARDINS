import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform, ScrollView, FlatList, Modal, Image } from 'react-native';
import { CameraView, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Notifications from 'expo-notifications';
import { collection, getDocs, doc, query, where, updateDoc, addDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Card, Title, Paragraph, Badge } from 'react-native-paper';
import QRCode from 'react-native-qrcode-svg';

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
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [scanMode, setScanMode] = useState<'direct' | 'picture'>('direct');
  
  // État du QR code généré
  const [qrCodeVisible, setQrCodeVisible] = useState(false);
  const [panierSelectionne, setPanierSelectionne] = useState<Panier | null>(null);
  const [panierQrValue, setPanierQrValue] = useState<string>('');
  
  // Configuration avancée des notifications
  useEffect(() => {
    const configureNotifications = async () => {
      if (Platform.OS !== 'web') {
        // Configuration spéciale pour que les notifications apparaissent au milieu de l'écran sur iOS
        Notifications.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            // Ces options améliorent la visibilité sur iOS
            ios: {
              presentAlert: true,
              presentBadge: true,
              presentSound: true,
            }
          }),
        });
        
        // Configuration spécifique pour iOS
        if (Platform.OS === 'ios') {
          try {
            // Configuration avancée des notifications iOS
            await Notifications.setNotificationCategoryAsync('livraison', [
              {
                identifier: 'voir',
                buttonTitle: 'Voir détails',
                options: {
                  opensAppToForeground: true,
                },
              },
            ]);
          } catch (error) {
            console.log('Erreur lors de la configuration iOS:', error);
          }
        }

        // Configuration pour Android
        if (Platform.OS === 'android') {
          try {
            await Notifications.setNotificationChannelAsync('livraison', {
              name: 'Livraisons',
              importance: Notifications.AndroidImportance.HIGH,
              vibrationPattern: [0, 250, 250, 250],
              lightColor: '#4caf50',
              sound: 'default',
              enableVibrate: true,
              showBadge: true,
            });
          } catch (error) {
            console.log('Erreur lors de la configuration du canal Android:', error);
          }
        }

        // Demander les permissions avec options avancées
        try {
          const { status: existingStatus } = await Notifications.getPermissionsAsync();
          let finalStatus = existingStatus;
          
          if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync({
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                // Force l'affichage des alertes au centre sur iOS
                provideAppNotificationSettings: true,
              },
            });
            finalStatus = status;
          }
          
          if (finalStatus !== 'granted') {
            console.log('Permission de notification non accordée');
          }
        } catch (error) {
          console.log('Erreur lors de la demande de permissions:', error);
        }
      }
    };

    configureNotifications();

    // Configuration de la gestion des notifications reçues
    const subscription = Notifications.addNotificationReceivedListener(notification => {
      console.log('Notification reçue:', notification);
    });

    return () => {
      subscription.remove();
    };
  }, []);

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

  // Déterminer le mode de scan en fonction de la plateforme
  useEffect(() => {
    if (Platform.OS === 'web') {
      setScanMode('picture');
    } else {
      setScanMode('direct');
    }
  }, []);

  // Fonction pour envoyer une notification - optimisée pour iOS
  const envoyerNotificationPush = async (titre: string, message: string) => {
    // Sur le web, nous n'utilisons pas les notifications Expo
    if (Platform.OS === 'web') {
      console.log("✅ Message de notification (web):", titre, message);
      return;
    }
    
    // Pour les plateformes natives (iOS, Android)
    try {
      const identifier = await Notifications.scheduleNotificationAsync({
        content: {
          title: titre,
          body: message,
          // Configuration spéciale pour iOS (pour que la notification apparaisse au milieu)
          data: { 
            type: 'livraison',
            panierId: panierSelectionne?.id || '',
            depotId: foundDepot?.id || ''
          },
          // Options spécifiques à la plateforme
          sound: 'default',
          badge: 1,
          // Configuration améliorée pour iOS
          ...(Platform.OS === 'ios' ? {
            categoryIdentifier: 'livraison',
            // Force l'affichage comme alerte au milieu de l'écran sur iOS
            _displayInForeground: true,
          } : {}),
          // Configuration spécifique pour Android
          ...(Platform.OS === 'android' ? {
            channelId: 'livraison',
            color: '#4caf50',
            priority: 'high',
          } : {})
        },
        trigger: null, // Notification immédiate
      });
      
      console.log("✅ Notification native envoyée, ID:", identifier);
      
      // Sur iOS, pour forcer une notification immédiate même si l'app est en premier plan
      if (Platform.OS === 'ios') {
        // Forcer l'affichage de la notification
        await Notifications.presentNotificationAsync({
          title: titre,
          body: message,
          data: { 
            type: 'livraison',
            panierId: panierSelectionne?.id || '',
            depotId: foundDepot?.id || ''
          },
          sound: true,
          categoryIdentifier: 'livraison',
        });
      }
    } catch (error) {
      console.error("❌ Erreur lors de l'envoi de la notification:", error);
    }
  };

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

  // Cherche le point de dépôt correspondant au numéro scanné
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

  // Générer un QR code pour un panier
  const genererQrCodePanier = (panier: Panier) => {
    setPanierSelectionne(panier);
    
    // Créer un objet avec les informations essentielles du panier
    const panierInfo = {
      id: panier.id,
      type: panier.type,
      clientId: panier.clientId,
      depotId: foundDepot?.id || '',
      depotNom: foundDepot?.lieu || '',
      composition: panier.composition,
      statut: panier.statut
    };
    
    // Convertir en JSON pour le QR code
    const qrValue = JSON.stringify(panierInfo);
    setPanierQrValue(qrValue);
    
    // Afficher le modal avec le QR code
    setQrCodeVisible(true);
  };

  // Marquer un panier comme distribué dans la base de données
  const marquerPanierDistribue = async (panierId: string) => {
    try {
      // Référence au document du panier dans Firestore
      const panierRef = doc(db, "paniers", panierId);

      const dateDistribution = new Date();
      
      // Mettre à jour le statut dans Firestore
      await updateDoc(panierRef, {
        statut: "livré",
        dateLivraison: dateDistribution // Ajouter un timestamp de livraison
      });

      // Récupérer les infos du panier
      const panierInfo = panierSelectionne || 
        paniersFiltres.find(p => p.id === panierId) || 
        { type: "Panier", clientId: "inconnu" };

      // Créer une notification dans Firestore
      const notificationData = {
        titre: "Panier distribué",
        message: `Le ${panierInfo.type} pour le client ${panierInfo.clientId} a été distribué au dépôt ${foundDepot?.lieu || 'inconnu'}`,
        date: dateDistribution,
        type: "livraison",
        panierId: panierId,
        depotId: foundDepot?.id || '',
        lu: false,
        userId: "current-user-id" // À remplacer par l'ID de l'utilisateur connecté
      };
      
      // Ajouter la notification à Firestore
      await addDoc(collection(db, "notifications"), notificationData);
      
      // Envoyer la notification push avec des options améliorées
      await envoyerNotificationPush(notificationData.titre, notificationData.message);

      // Mettre à jour l'état local des paniers
      setPaniersFiltres(prev => 
        prev.map(p => 
          p.id === panierId ? {...p, statut: "livré"} : p
        )
      );

      // Mettre à jour le panier sélectionné
      if (panierSelectionne) {
        setPanierSelectionne({...panierSelectionne, statut: "livré"});
      }

      Alert.alert("Succès", "Panier marqué comme distribué!");
      
      // Fermer le modal QR code
      setQrCodeVisible(false);
      setPanierSelectionne(null);
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut du panier:", error);
      
      // Gestion des erreurs
      if (error instanceof Error) {
        Alert.alert(
          "Erreur de mise à jour", 
          `Une erreur est survenue : ${error.message}`
        );
      }
    }
  };

  // Gestion du scan QR direct (pour mobile)
  const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
    if (scanned) return;
    
    setScanned(true);
    const scannedData = data.trim();
    setQrData(scannedData);
    
    console.log(`📱 QR Code scanné (direct): "${scannedData}"`);
    
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
  };
  
  // Capturer une photo pour scanner le QR code (pour web)
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
            // Pour les plateformes mobiles (fallback si le scan direct ne fonctionne pas)
            try {
              // Tenter d'utiliser l'API native pour le traitement des QR codes
              const { scanFromURLAsync } = await import('expo-barcode-scanner');
              const scanResult = await scanFromURLAsync(manipResult.uri, ['qr']);
              
              if (scanResult.length > 0) {
                const qrCodeData = scanResult[0].data;
                handleQRCodeData(qrCodeData);
              } else {
                Alert.alert("Information", "Aucun QR code détecté. Veuillez réessayer.");
                setScanned(false);
              }
            } catch (error) {
              console.error("Erreur lors du traitement du QR code:", error);
              Alert.alert("Erreur", "Impossible de scanner le QR code. Réessayez.");
              setScanned(false);
            }
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

  // Traiter les données d'un QR code (utilisé par les deux méthodes)
  const handleQRCodeData = (data: string) => {
    const scannedData = data.trim();
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
              handleQRCodeData(code.data);
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

  // Entrée manuelle d'un code QR
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
      if (scanMode === 'picture') {
        takePicture();
      } else {
        // Le scan est géré par onBarCodeScanned sur la vue caméra
        // Nous activons juste le mode scan
        setScanned(false);
      }
    }
  };

  // Basculer entre les modes de scan
  const toggleScanMode = () => {
    setScanMode(prev => prev === 'direct' ? 'picture' : 'direct');
    setScanned(false);
  };

  // Réinitialiser le scan
  const resetScan = () => {
    setScanned(false);
    setQrData(null);
    setFoundDepot(null);
    setPaniersFiltres([]);
    setDebugInfo('');
    setPanierSelectionne(null);
    setQrCodeVisible(false);
  };

  // Afficher les paniers du dépôt avec des boutons pour générer des QR codes
  const renderPaniers = () => {
    return (
      <View style={styles.paniersContainer}>
        <Text style={styles.paniersTitle}>🚚 Paniers disponibles</Text>
        {paniersFiltres.length > 0 ? (
          <FlatList
            data={paniersFiltres}
            keyExtractor={(panier) => panier.id}
            renderItem={({ item: panier }) => (
              <TouchableOpacity 
                onPress={() => genererQrCodePanier(panier)}
                style={styles.panierTouchable}
              >
                <Card style={[
                  styles.panierCard, 
                  panier.statut === 'livré' ? styles.panierLivre : null
                ]}>
                  <Card.Content>
                    <View style={styles.panierHeader}>
                      <Title style={styles.panierType}>{panier.type}</Title>
                      {panier.statut === 'livré' && (
                        <Badge style={styles.panierBadge}>Livré</Badge>
                      )}
                    </View>
                    <Paragraph style={styles.panierText}>📦 {panier.composition.join(", ")}</Paragraph>
                    <Paragraph style={styles.panierStatus}>🔹 {panier.statut}</Paragraph>
                    <Paragraph style={styles.panierClient}>👤 Client : {panier.clientId}</Paragraph>
                    <Paragraph style={styles.panierAction}>
                      📲 Appuyez pour générer un QR code
                    </Paragraph>
                  </Card.Content>
                </Card>
              </TouchableOpacity>
            )}
          />
        ) : (
          <Text style={styles.noPaniersText}>Aucun panier trouvé pour ce dépôt</Text>
        )}
      </View>
    );
  };

  // Modal pour afficher le QR code du panier
  const renderQrCodeModal = () => {
    return (
      <Modal
        visible={qrCodeVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setQrCodeVisible(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.qrCodeContainer}>
            <Text style={styles.qrCodeTitle}>
              QR Code du panier
            </Text>
            
            {panierSelectionne && (
              <>
                <Text style={styles.qrCodePanierInfo}>
                  {panierSelectionne.type} - Client: {panierSelectionne.clientId}
                </Text>
                
                <View style={styles.qrWrapper}>
                  {Platform.OS === 'web' ? (
                    // Solution pour le web
                    <Image 
                      source={{
                        uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(panierQrValue)}`
                      }}
                      style={styles.qrImage}
                    />
                  ) : (
                    // Solution pour mobile avec react-native-qrcode-svg
                    <QRCode
                      value={panierQrValue}
                      size={200}
                      backgroundColor="white"
                      color="black"
                    />
                  )}
                </View>
                
                <Text style={styles.qrInstructions}>
                  Montrez ce QR code au client ou scannez-le pour valider la livraison
                </Text>
                
                <View style={styles.qrButtonsContainer}>
                  <TouchableOpacity 
                    style={styles.qrButton}
                    onPress={() => setQrCodeVisible(false)}
                  >
                    <Text style={styles.qrButtonText}>Fermer</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.qrButton, styles.qrValidateButton]}
                    onPress={() => marquerPanierDistribue(panierSelectionne.id)}
                  >
                    <Text style={styles.qrButtonText}>
                      Marquer comme distribué
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
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
            onBarcodeScanned={scanMode === 'direct' && !scanned ? handleBarCodeScanned : undefined}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />
          
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>
              Scannez le QR code du point de dépôt
            </Text>
            <Text style={styles.overlaySubText}>
              {scanMode === 'direct' 
                ? "Placez le QR code dans le cadre" 
                : "Appuyez sur Scanner pour prendre une photo"}
            </Text>
          </View>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={styles.button} 
              onPress={handleScan} 
              disabled={scanned}
            >
              <Text style={styles.buttonText}>
                {scanned 
                  ? "Scan en cours..." 
                  : scanMode === 'direct' ? "Scanner en direct" : "Prendre une photo"
                }
              </Text>
            </TouchableOpacity>
            
            {Platform.OS !== 'web' && (
              <TouchableOpacity 
                style={[styles.button, styles.switchButton]} 
                onPress={toggleScanMode}
                disabled={scanned}
              >
                <Text style={styles.buttonText}>
                  {scanMode === 'direct' 
                    ? "Passer au mode photo" 
                    : "Passer au scan en direct"
                  }
                </Text>
              </TouchableOpacity>
            )}
            
            <TouchableOpacity 
              style={[styles.button, styles.secondaryButton]} 
              onPress={handleManualInput}
            >
              <Text style={styles.buttonText}>Saisir un numéro manuellement</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <ScrollView contentContainerStyle={styles.resultContainer}>
          <Text style={styles.resultTitle}>Point de dépôt scanné</Text>
          
          {foundDepot ? (
            <>
              <Card style={styles.depotCard}>
                <Card.Content>
                  <Title style={styles.depotTitle}>{foundDepot.lieu}</Title>
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
      
      {/* Modal pour afficher le QR code du panier */}
      {renderQrCodeModal()}
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212',
  },
  camera: {
    flex: 1,
    width: '100%',
  },
  overlay: {
    position: 'absolute',
    top: '20%',
    left: 0,
    right: 0,
    alignItems: 'center',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  overlayText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  overlaySubText: {
    color: '#FFA500',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
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
  switchButton: {
    backgroundColor: '#FF9800', // Orange pour le bouton de changement de mode
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
    padding: 20,
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
  panierTouchable: {
    marginBottom: 10,
  },
  panierCard: {
    backgroundColor: '#2c2c2c',
    borderRadius: 10,
  },
  panierLivre: {
    backgroundColor: '#1b5e20', // Vert foncé pour les paniers livrés
    opacity: 0.8,
  },
  panierHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  panierType: {
    color: '#4caf50',
    fontSize: 18,
  },
  panierBadge: {
    backgroundColor: '#4caf50',
    color: 'white',
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
  panierAction: {
    color: '#FFA500',
    marginTop: 10,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  noPaniersText: {
    color: '#ff5252',
    textAlign: 'center',
    fontSize: 16,
  },
  
  // Styles pour le modal QR code
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 20,
  },
  qrCodeContainer: {
    backgroundColor: '#2c2c2c',
    borderRadius: 15,
    padding: 20,
    width: '90%',
    maxWidth: 400,
    alignItems: 'center',
  },
  qrCodeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
    textAlign: 'center',
  },
  qrCodePanierInfo: {
    fontSize: 16,
    color: '#4caf50',
    marginBottom: 20,
    textAlign: 'center',
  },
  qrWrapper: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
  },
  qrImage: {
    width: 200,
    height: 200,
  },
  qrInstructions: {
    color: '#e0e0e0',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 20,
  },
  qrButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
  },
  qrButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    width: '45%',
    alignItems: 'center',
  },
  qrValidateButton: {
    backgroundColor: '#4caf50',
  },
  qrButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 14,
  }
});