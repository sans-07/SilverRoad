import React, { useEffect } from 'react';
import { useMap } from 'react-leaflet';

const MapResizer = () => {
  const map = useMap();

  useEffect(() => {
    console.log('[MapResizer] Effect triggered. Map instance available.');

    const mapContainer = map.getContainer();
    console.log('[MapResizer] Map container element:', mapContainer);

    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        console.log('[MapResizer] ResizeObserver fired!', entry.contentRect);
        map.invalidateSize();
        console.log('[MapResizer] map.invalidateSize() called.');
      }
    });

    if (mapContainer) {
      resizeObserver.observe(mapContainer);
      console.log('[MapResizer] ResizeObserver started observing map container.');
    }

    // Workaround for initial load
    setTimeout(() => {
      console.log('[MapResizer] Forcing invalidateSize after 100ms timeout.');
      map.invalidateSize();
    }, 100);

    return () => {
      console.log('[MapResizer] Cleanup function called.');
      if (mapContainer) {
        resizeObserver.unobserve(mapContainer);
        console.log('[MapResizer] ResizeObserver stopped observing.');
      }
      resizeObserver.disconnect();
    };
  }, [map]);

  return null;
};

export default MapResizer;
