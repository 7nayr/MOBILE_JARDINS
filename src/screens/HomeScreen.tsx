import React from 'react';
import { View, Text, StyleSheet, ImageBackground, Image } from 'react-native';

const HomeScreen = () => {
  return (
    <ImageBackground source={require('../../assets/images/background.jpg')} style={styles.backgroundImage}>
      <View style={styles.overlay}>
        <Image source={require('../../assets/images/logo.png')} style={styles.icon} />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Les Jardins</Text>
          <Text style={styles.title}>de</Text>
          <Text style={styles.title}>Cocagne</Text>
        </View>
        <Text style={styles.subtitle}>Application Livreurs</Text>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
    resizeMode: 'cover',
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  icon: {
    position: 'absolute',
    top: 40,
    left: 20,
    width: 40,
    height: 40,
  },
  titleContainer: {
    marginBottom: 20,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  subtitle: {
    fontSize: 14,
    color: 'white',
    marginTop: 10,
  },
});

export default HomeScreen;
