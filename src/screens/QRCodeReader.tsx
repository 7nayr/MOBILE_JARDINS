import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Appbar, ActivityIndicator, Button } from 'react-native-paper';

const QRCodeReader: React.FC = () => {
    const [qrCodeContent, setQrCodeContent] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);

    useEffect(() => {
        (async () => {
            const { status } = await ImagePicker.requestCameraPermissionsAsync();
            setCameraPermission(status === 'granted');
        })();
    }, []);

    const handleTakePicture = async () => {
        const cameraPermission = await ImagePicker.getCameraPermissionsAsync();
        if (Platform.OS === 'web' || !cameraPermission.granted) {
            alert("Camera not available on simulator");
            return;
        }
        setLoading(true);
        try {
            const result = await ImagePicker.launchCameraAsync({
                allowsEditing: false,
                quality: 1,
            });

            if (!result.canceled) {
                // Simulate QR code extraction
                const extractedContent = "Simulated QR Code Content"; // Replace with actual extraction logic
                setQrCodeContent(extractedContent);
            }
        } catch (error) {
            console.error("❌ Error taking picture:", error);
            setQrCodeContent(null);
        } finally {
            setLoading(false);
        }
    };

    if (cameraPermission === null) {
        return <Text>Requesting camera permission...</Text>;
    }
    if (cameraPermission === false) {
        return <Text>No access to camera</Text>;
    }

    return (
        <View style={styles.container}>
            <Appbar.Header style={styles.appbar}>
                <Appbar.Content title="📷 Scan QR Code" />
            </Appbar.Header>

            <View style={styles.content}>
                {!qrCodeContent ? (
                    <TouchableOpacity 
                        style={styles.captureButton} 
                        onPress={handleTakePicture}
                    >
                        <Text style={styles.captureText}>Press to Scan</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.resultContainer}>
                        {loading ? (
                            <ActivityIndicator size="large" color="#4CAF50" />
                        ) : (
                            <Text style={styles.qrCodeContent}>{qrCodeContent}</Text>
                        )}
                        <Button mode="contained" onPress={() => setQrCodeContent(null)} style={styles.scanButton}>
                            Scan Again
                        </Button>
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    appbar: {
        backgroundColor: '#1f1f1f',
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureButton: {
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: '#4CAF50',
        justifyContent: 'center',
        alignItems: 'center',
    },
    captureText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
    resultContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    qrCodeContent: {
        fontSize: 18,
        color: '#e0e0e0',
        marginBottom: 20,
    },
    scanButton: {
        backgroundColor: '#4CAF50',
        marginTop: 15,
    }
});

export default QRCodeReader;
