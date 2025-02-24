import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, Text } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { Button } from 'react-native-paper';

const ScannerScreen = () => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    const getPermissions = async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    };

    getPermissions();
  }, []);

  const handleBarCodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScanned(true);
    try {
      const qrData = JSON.parse(data);
      if (qrData.depot) { 
        Alert.alert("Dépôt Scanné", `Dépôt : ${qrData.depot}`);
      } else if (qrData.panierId) {
        Alert.alert("Panier Scanné", `Panier ID: ${qrData.panierId}`);
      } else {
        Alert.alert("Erreur", "QR Code invalide !");
      }
    } catch (error) {
      Alert.alert("Erreur", "QR Code invalide !");
    }
  };

  if (hasPermission === null) {
    return <Text>Demande d'autorisation de la caméra...</Text>;
  }
  if (hasPermission === false) {
    return <Text>Accès à la caméra refusé</Text>;
  }

  return (
    <View style={styles.container}>
      <BarCodeScanner
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        style={styles.scanner}
      />
      {scanned && <Button mode="contained" onPress={() => setScanned(false)}>Scanner à nouveau</Button>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  scanner: {
    flex: 1,
    width: '100%',
  },
});

export default ScannerScreen;
