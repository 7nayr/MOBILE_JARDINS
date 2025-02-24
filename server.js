const express = require('express');
const QRCode = require('qrcode');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(cors());
app.use(express.json());

// Générer le fichier index.html si non existant
const indexPath = path.join(__dirname, 'index.html');
if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, `
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Serveur QR Code</title>
        </head>
        <body>
            <h1>🚀 Serveur QR Code opérationnel !</h1>
            <p>Utilisez l'API pour générer des QR codes.</p>
        </body>
        </html>
    `);
}

// Servir une page HTML pour éviter "Cannot GET /"
app.get('/', (req, res) => {
    res.sendFile(indexPath);
});

// Route pour générer un QR Code
app.post('/generate-qr', async (req, res) => {
    try {
        const { type, id } = req.body; // Type: "depot" ou "panier"
        const qrData = JSON.stringify({ [type]: id });
        const qrCode = await QRCode.toDataURL(qrData);

        res.json({ qrCode });
    } catch (error) {
        res.status(500).json({ error: "Erreur lors de la génération du QR code" });
    }
});

// Démarrer le serveur sur le port défini ou 5000 par défaut
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`🚀 Serveur QR Code lancé sur http://localhost:${PORT}`));
