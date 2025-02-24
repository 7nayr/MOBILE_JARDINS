declare module 'react-native-web-maps' {
    import React from 'react';

    interface MapProps {
        style?: any;
        defaultCenter?: { lat: number; lng: number };
        defaultZoom?: number;
    }

    interface MarkerProps {
        position: { lat: number; lng: number };
        title?: string;
    }

    interface PolylineProps {
        positions: { lat: number; lng: number }[];
        strokeColor?: string;
        strokeWidth?: number;
    }

    export const Map: React.FC<MapProps>;
    export const Marker: React.FC<MarkerProps>;
    export const Polyline: React.FC<PolylineProps>;
}
