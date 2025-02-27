# Jardins de Cocagne - Application Livreurs

Application mobile pour la gestion des livraisons de paniers des Jardins de Cocagne. Cette application permet aux livreurs de visualiser leurs tournées, scanner les QR codes des points de dépôt, gérer les paniers et recevoir des notifications.

## 📱 Fonctionnalités

- **Écran d'accueil** : Point d'entrée de l'application
- **Gestion des paniers** : Visualisation et récapitulatif des paniers à livrer
- **Tournées** : Visualisation et gestion des tournées du jour
- **Points de dépôt** : Carte interactive des points de dépôt avec itinéraires
- **Scanner QR Code** : Lecture des QR codes des points de dépôt et des paniers
- **Notifications** : Système de notifications pour les livraisons et informations importantes

## 🗂️ Structure du projet

### Configuration

- `config.ts` : Configuration Firebase pour la base de données

### Écrans principaux

- `HomeScreen.tsx` : Écran d'accueil avec le logo de l'application
- `notifications.tsx` : Gestion des notifications (lecture, marquage comme lues)
- `MapDepot.tsx` : Carte interactive des points de dépôt avec intégration Google Maps
- `QRCodeReader.tsx` : Scanner pour lire les QR codes des points de dépôt et des paniers
- `RecapPaniersScreen.tsx` : Récapitulatif des paniers à livrer
- `TourneeScreen.tsx` : Gestion des tournées avec liste des points de dépôt

### Navigation

- `_layout.tsx` : Configuration de la navigation par onglets avec expo-router
- Fichiers de routage : `index.tsx`, `panier.tsx`, `tournee.tsx`, `depot.tsx`, `qrcode.tsx`, `notif.tsx`

## 🔍 Fonctionnalités détaillées

### Carte des dépôts
Affiche une carte interactive avec les points de dépôt et calcule les itinéraires entre les points. Possibilité de voir les adresses détaillées et les instructions de navigation.

### Scanner QR Code
Permet de scanner les QR codes des points de dépôt pour accéder aux informations des paniers à livrer. Possibilité de marquer les paniers comme distribués et de générer des QR codes pour chaque panier.

### Notifications
Système complet de notifications avec support pour iOS et Android. Les notifications peuvent être marquées comme lues et contiennent des informations sur les livraisons.

### Tournées
Visualisation des tournées avec liste des points de dépôt. Interface animée pour démarrer une tournée.

### Récapitulatif des paniers
Vue d'ensemble des paniers à livrer, organisés par jour avec leurs compositions et statuts.

## 🚀 Démarrage

### Prérequis

- Node.js
- Expo CLI
- Compte Firebase (les configurations sont déjà présentes dans le code)

### Installation

```bash
# Cloner le dépôt
git clone [URL_DU_DEPOT]
cd jardins-de-cocagne-app

# Installer les dépendances
npm install
```

### Lancement

```bash
# Démarrer l'application avec nettoyage du cache
npx expo start -c

# Options de lancement:
# - Appuyer sur 'w' pour ouvrir dans le navigateur web
# - Appuyer sur 'i' pour ouvrir dans le simulateur iOS
# - Scanner le QR code avec l'application Expo Go sur votre téléphone personnel
```

## 📦 Dépendances principales

- **React Native** : Framework pour le développement mobile
- **Expo** : Plateforme de développement React Native
- **Firebase/Firestore** : Base de données et backend
- **React Native Paper** : Composants UI Material Design
- **Expo Router** : Navigation
- **Google Maps API** : Cartographie et calcul d'itinéraires
- **Expo Camera** : Accès à la caméra pour le scanner QR code
- **Firebase Authentication** : Gestion des utilisateurs (à implémenter)

## 🔒 Sécurité

⚠️ Note: Ce code contient des clés API et des configurations Firebase. Dans un environnement de production, ces informations sensibles devraient être stockées de manière sécurisée dans des variables d'environnement.

## 📝 Notes pour les développeurs

- L'application utilise Firestore pour stocker les données des tournées, paniers et points de dépôt
- Les notifications sont optimisées pour iOS et Android avec des configurations spécifiques à chaque plateforme
- Le scanner QR code a deux modes : direct (pour mobile) et photo (compatible web)
- L'application est conçue avec un thème sombre par défaut pour économiser la batterie
- Les composants UI utilisent React Native Paper pour une interface cohérente

## 🏗️ Améliorations futures

- Authentification utilisateur
- Mode hors ligne
- Optimisation des performances
- Tests unitaires et d'intégration
- Implémentation de rapports de livraison