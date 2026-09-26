import crypto from 'crypto';
import { logger } from '../utils/logger';

export interface GeocodeResult {
  latitude: number;
  longitude: number;
}

/**
 * Mock Google Maps Geocoding API integration.
 *
 * This service generates deterministic pseudo-random coordinates based on the input address.
 * It does NOT call the real Google Maps API, making it safe for local development and testing.
 */
export class GeocodingService {
  static async geocodeAddress(
    address: string,
    city: string,
    province: string,
    postalCode: string
  ): Promise<GeocodeResult> {
    const fullAddress = `${address}, ${city}, ${province}, ${postalCode}`;

    // Use a hash of the address to generate stable pseudo-random coordinates
    const hash = crypto.createHash('sha256').update(fullAddress).digest('hex');

    const latSeed = parseInt(hash.substring(0, 8), 16);
    const lngSeed = parseInt(hash.substring(8, 16), 16);

    const latitude = (latSeed % 180) - 90; // [-90, 90]
    const longitude = (lngSeed % 360) - 180; // [-180, 180]

    const result: GeocodeResult = {
      latitude,
      longitude,
    };

    logger.info(
      `[Geocoding Mock] Geocoded "${fullAddress}" to (${result.latitude}, ${result.longitude})`
    );

    return result;
  }
}

