# Jardins de Cocagne - Application Livreurs 🌱

Bienvenue dans l'application mobile des [Jardins de Cocagne](https://www.reseaucocagne.asso.fr/) pour la gestion des livraisons de paniers biologiques. Créée avec [Expo](https://expo.dev) et React Native, cette application aide les livreurs à gérer efficacement leurs tournées et livraisons.

## Get started

1. Cloner le dépôt

   ```bash
   git clone [URL_DU_DEPOT]
   cd MOBILE_JARDINS
   ```

2. Installer les dépendances

   ```bash
   npm install
   ```

3. Démarrer l'application

   ```bash
   npx expo start -c
   ```

Dans la sortie du terminal, vous trouverez les options pour ouvrir l'application:

- Appuyez sur `w` pour ouvrir dans le navigateur web
- Appuyez sur `i` pour ouvrir dans le simulateur iOS
- Scannez le QR code avec l'application [Expo Go](https://expo.dev/go) sur votre téléphone personnel

## 📂 Fichiers principaux et leurs fonctionnalités

### Configuration Firebase (`config.ts`)

Configuration de la connexion à Firebase et Firestore.

**Fonctions principales:**
- Initialisation de Firebase et Firestore
- Configuration conditionnelle de Firebase Analytics en fonction de l'environnement

### Écran d'accueil (`HomeScreen.tsx`)

Page d'accueil de l'application affichant le logo des Jardins de Cocagne.

**Fonctions principales:**
- Mise en page responsive avec `ImageBackground` et superposition
- Affichage du titre et du sous-titre

### Gestion des Notifications (`notifications.tsx`)

Écran de gestion des notifications pour les livreurs.

**Fonctions principales:**
- `fetchNotifications()`: Récupère les notifications de l'utilisateur depuis Firestore
- `marquerCommeLue()`: Marque une notification individuelle comme lue
- `marquerToutesLues()`: Marque toutes les notifications comme lues
- `renderNotification()`: Affiche une notification avec son icône, titre et contenu
- `renderContent()`: Gère l'affichage conditionnel (chargement, liste vide, notifications)

### Carte des Points de Dépôt (`MapDepot.tsx`)

Affiche une carte interactive des points de dépôt avec calcul d'itinéraire.

**Fonctions principales:**
- `fetchTournees()`: Récupère les données des tournées depuis Firestore
- `fetchDepots()`: Récupère les dépôts pour une tournée sélectionnée
- `generateMapHtml()`: Génère le HTML pour la carte Google Maps
- `handleWebViewMessage()`: Traite les messages entre la WebView et React Native
- `calcRoute()`: Calcule l'itinéraire entre les points de dépôt
- `handleSelectTournee()`: Gère la sélection d'une tournée par l'utilisateur

### Scanner QR Code (`QRCodeReader.tsx`)

Scanner pour lire les QR codes des points de dépôt et des paniers.

**Fonctions principales:**
- `handleBarCodeScanned()`: Traite les données lues par le scanner QR (mode direct)
- `takePicture()`: Capture une photo pour scanner le QR code (mode web)
- `findDepotByNumero()`: Recherche un point de dépôt par son numéro de QR code
- `fetchPaniersPourDepot()`: Récupère les paniers pour un point de dépôt spécifique
- `marquerPanierDistribue()`: Marque un panier comme distribué et envoie une notification
- `genererQrCodePanier()`: Génère un QR code pour un panier spécifique
- `envoyerNotificationPush()`: Envoie une notification push (iOS/Android)

### Récapitulatif des Paniers (`RecapPaniersScreen.tsx`)

Affiche le récapitulatif des paniers à livrer organisés par jour.

**Fonctions principales:**
- `fetchPaniers()`: Récupère tous les paniers depuis Firestore
- Organisation des paniers par jour de tournée
- Affichage du type de panier, de sa composition et de son statut

### Gestion des Tournées (`TourneeScreen.tsx`)

Affiche les tournées du jour avec leurs points de dépôt.

**Fonctions principales:**
- `fetchTournees()`: Récupère les tournées avec leurs points de dépôt depuis Firestore
- `toggleExpand()`: Développe/réduit la liste des points de dépôt d'une tournée
- `handleStartTournee()`: Initialise le démarrage d'une tournée
- `confirmStartTournee()`: Anime la confirmation de démarrage avec une barre de progression
- Affichage des informations détaillées sur chaque point de dépôt

### Navigation (`_layout.tsx`)

Configuration de la navigation par onglets de l'application.

**Fonctions principales:**
- Définition des onglets avec leurs icônes
- Configuration du style et du comportement de la barre de navigation
- Intégration du retour haptique sur les onglets (HapticTab)

## 🔄 Flux de données

### Firestore Collections

L'application utilise plusieurs collections dans Firestore:

- **tournees**: Informations sur les tournées et références aux points de dépôt
- **points_depots**: Détails des points de dépôt (lieu, adresse, coordonnées)
- **paniers**: Informations sur les paniers à livrer (composition, statut, client)
- **notifications**: Notifications système et utilisateur

### Fonctionnement principal

1. L'utilisateur se connecte et voit l'écran d'accueil
2. Il peut consulter ses tournées du jour et leurs points de dépôt
3. En sélectionnant une tournée, il peut visualiser l'itinéraire sur la carte
4. Au point de dépôt, il scanne le QR code pour confirmer son arrivée
5. L'application affiche les paniers à déposer à ce point
6. Il peut marquer les paniers comme livrés, déclenchant des notifications

## 📱 Fonctionnalités techniques

### Système de carte

- Intégration de Google Maps via WebView pour une compatibilité maximale
- Calcul d'itinéraires optimisés entre les points de dépôt
- Affichage des informations détaillées sur les étapes du trajet

### Scanner QR Code

- Double mode de fonctionnement: scan direct et capture d'image
- Compatible avec les plateformes web et mobiles
- Traitement des données QR code avec bibliothèques adaptatives

### Système de notifications

- Support natif pour iOS et Android avec configurations spécifiques
- Stockage des notifications dans Firestore pour persistance
- Interface utilisateur pour marquer comme lues et filtrer

### Interface adaptative

- Thème sombre pour économiser la batterie
- Composants Material Design avec React Native Paper
- Support des appareils iOS et Android avec styles adaptés

## 📦 Dépendances principales

- **React Native**: Framework pour le développement mobile
- **Expo**: Plateforme de développement React Native
- **Firebase/Firestore**: Base de données et backend
- **React Native Paper**: Composants UI Material Design
- **Expo Router**: Navigation
- **Google Maps API**: Cartographie et calcul d'itinéraires
- **Expo Camera**: Accès à la caméra pour le scanner QR code
- **JSQr/Expo Barcode Scanner**: Traitement des codes QR

## 🚀 Installation et déploiement

### Exigences du système

- Node.js 14 ou supérieur
- Expo CLI
- Accès à Firebase (configuration fournie dans `config.ts`)
- Compte Google pour l'API Maps

### Configuration des API

La clé Google Maps est configurée dans le fichier `MapDepot.tsx`:
```javascript
const GOOGLE_MAPS_API_KEY = "AIzaSyCf2igaoyY9Be4tUdFf71mFPJ1Z0baQ3P8";
```

Pour un déploiement en production, cette clé devrait être sécurisée via des variables d'environnement.

## 🔒 Sécurité

⚠️ Note: Ce code contient des clés API et des configurations Firebase. Dans un environnement de production, ces informations sensibles devraient être stockées de manière sécurisée via:

- Variables d'environnement
- Expo secure store pour les informations sur l'appareil
- Firebase Authentication pour la gestion des utilisateurs

## 🏗️ Améliorations futures

- **Authentification utilisateur**: Implémenter Firebase Auth pour la gestion des utilisateurs
- **Mode hors ligne**: Synchronisation des données en arrière-plan
- **Optimisation des performances**: Réduire les requêtes Firestore et mise en cache
- **Tests unitaires et d'intégration**: Améliorer la fiabilité de l'application
- **Rapports de livraison**: Générer des statistiques sur les livraisons effectuées
- **Notifications push avancées**: Améliorer le système pour les notifications programmées
- **Optimisation des itinéraires**: Algorithme pour calculer les itinéraires les plus efficaces

## En savoir plus

- [Documentation Expo](https://docs.expo.dev/)
- [Guide Firebase](https://firebase.google.com/docs)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Documentation Google Maps API](https://developers.google.com/maps/documentation)

# MOBILE_JARDINS
# MOBILE_JARDINS
# MOBILE_JARDINS