import React, { useState } from 'react';
import { View, StyleSheet, TextInput, Alert, Image } from 'react-native';
import { Button, Card, Title } from 'react-native-paper';

const QRCodeScreen = () => {
  const [id, setId] = useState("");
  const [type, setType] = useState(""); // "depot" ou "panier"
  const [qrValue, setQrValue] = useState("");

  const generateQRCode = async () => {
    if (!id || !type) {
      Alert.alert("Erreur", "Veuillez entrer un ID et choisir un type !");
      return;
    }

    try {
      const response = await fetch('http://localhost:5001/generate-qr', { // Assure-toi que l'URL correspond à ton serveur
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, id }),
      });

      const data = await response.json();
      if (data.qrCode) {
        setQrValue(data.qrCode);
      } else {
        Alert.alert("Erreur", "Impossible de générer le QR code");
      }
    } catch (error) {
      console.error("Erreur de connexion:", error);
      Alert.alert("Erreur", "Serveur QR Code inaccessible");
    }
  };

  return (
    <View style={styles.container}>
      <Card style={styles.card}>
        <Title style={styles.title}>Générer un QR Code</Title>
        <TextInput
          style={styles.input}
          placeholder="ID du panier ou dépôt"
          placeholderTextColor="#bbb"
          value={id}
          onChangeText={setId}
        />
        <Button mode="contained" onPress={() => setType("depot")} style={styles.button}>Dépôt</Button>
        <Button mode="contained" onPress={() => setType("panier")} style={styles.button}>Panier</Button>
        <Button mode="contained" onPress={generateQRCode} style={styles.button}>Générer</Button>

        {qrValue ? <Image source={{ uri: qrValue }} style={styles.qrCode} /> : null}
      </Card>
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
  card: {
    padding: 20,
    backgroundColor: '#1E1E1E',
    borderRadius: 10,
  },
  title: {
    fontSize: 18,
    color: '#4CAF50',
    marginBottom: 10,
  },
  input: {
    backgroundColor: '#222',
    color: '#fff',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  button: {
    marginTop: 10,
    backgroundColor: '#4CAF50',
  },
  qrCode: {
    marginTop: 20,
    width: 200,
    height: 200,
  },
});

export default QRCodeScreen;
