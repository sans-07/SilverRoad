import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const MapResizer = () => {
  const map = useMap();

  useEffect(() => {
    const mapContainer = map.getContainer();

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        map.invalidateSize();
      }
    });

    if (mapContainer) {
      resizeObserver.observe(mapContainer);
    }

    // Workaround for initial load
    setTimeout(() => {
      map.invalidateSize();
    }, 100);

    return () => {
      if (mapContainer) {
        resizeObserver.unobserve(mapContainer);
      }
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
};

export default MapResizer;
