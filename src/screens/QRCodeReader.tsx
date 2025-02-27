import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

export default function App() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<boolean>(false);
  const [qrData, setQrData] = useState<string | null>(null);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission]);

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
              "Cette démo ne peut pas décoder les QR codes sur mobile sans expo-barcode-scanner. Essayez sur le web ou installez expo-barcode-scanner."
            );
            setScanned(false);
          }
        } else {
          throw new Error("Base64 image data is null");
        }
      } catch (error) {
        console.error("Erreur lors de la capture d'image:", error);
        Alert.alert("Erreur", "Impossible de scanner le QR code. Veuillez réessayer.");
        setScanned(false);
      }
    } else {
      Alert.alert("Erreur", "Caméra non disponible");
      setScanned(false);
    }
  };

  // Fonction pour traiter le QR code uniquement sur le web
  const processQRCodeOnWeb = async (base64Image: string): Promise<void> => {
    try {
      // Cette fonction n'est exécutée que sur le web
      // Nous utilisons ici des fonctionnalités du DOM qui n'existent que sur le web
      // @ts-ignore - Import dynamique uniquement sur le web
      const jsQR = (await import('jsqr')).default;
      
      return new Promise((resolve, reject) => {
        // Ces objets n'existent que dans l'environnement web
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
              setQrData(code.data);
              Alert.alert("QR Code détecté", `Contenu: ${code.data}`);
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

  const handleScan = () => {
    if (!scanned) {
      takePicture();
    }
  };

  const resetScan = () => {
    setScanned(false);
    setQrData(null);
  };

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

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing="back"
      />
      
      <View style={styles.buttonContainer}>
        {qrData ? (
          <View style={styles.resultsContainer}>
            <Text style={styles.resultText}>Données du QR Code:</Text>
            <Text style={styles.qrData}>{qrData}</Text>
            <TouchableOpacity style={styles.button} onPress={resetScan}>
              <Text style={styles.buttonText}>Scanner un autre code</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleScan} disabled={scanned}>
            <Text style={styles.buttonText}>{scanned ? "Scan en cours..." : "Scanner un QR Code"}</Text>
          </TouchableOpacity>
        )}
      </View>
      
      {Platform.OS !== 'web' && (
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Note: La fonctionnalité complète de décodage QR est disponible uniquement sur le web.
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
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
    backgroundColor: '#2196F3',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginVertical: 10,
    width: '80%',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resultsContainer: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  resultText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  qrData: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  text: {
    color: 'white',
    fontSize: 18,
    marginBottom: 20,
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
  }
});