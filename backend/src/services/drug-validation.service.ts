import axios from 'axios';
import { env } from '../config/env';
import { ApiError } from '../utils/api-error';
import { logger } from '../utils/logger';

/**
 * Standardized drug information returned from validation
 */
export interface DrugInfo {
  rxcui: string;
  name: string;
  synonym: string;
  fullGenericName: string;
  brandName: string;
  route: string;
  doseFormGroupName: string;
  isValid: boolean;
}

/**
 * Mock drug database used when RxNorm API is unavailable or in mock mode
 */
const MOCK_DRUG_DATABASE: Record<string, DrugInfo> = {
  amoxicillin: {
    rxcui: '723',
    name: 'Amoxicillin',
    synonym: 'Amoxicillin',
    fullGenericName: 'Amoxicillin',
    brandName: 'Amoxil',
    route: 'Oral',
    doseFormGroupName: 'Capsule',
    isValid: true,
  },
  ibuprofen: {
    rxcui: '5640',
    name: 'Ibuprofen',
    synonym: 'Ibuprofen',
    fullGenericName: 'Ibuprofen',
    brandName: 'Advil',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
  metformin: {
    rxcui: '6809',
    name: 'Metformin',
    synonym: 'Metformin Hydrochloride',
    fullGenericName: 'Metformin Hydrochloride',
    brandName: 'Glucophage',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
  lisinopril: {
    rxcui: '29046',
    name: 'Lisinopril',
    synonym: 'Lisinopril',
    fullGenericName: 'Lisinopril',
    brandName: 'Zestril',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
  paracetamol: {
    rxcui: '161',
    name: 'Acetaminophen',
    synonym: 'Paracetamol',
    fullGenericName: 'Acetaminophen',
    brandName: 'Tylenol',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
  acetaminophen: {
    rxcui: '161',
    name: 'Acetaminophen',
    synonym: 'Paracetamol',
    fullGenericName: 'Acetaminophen',
    brandName: 'Tylenol',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
  aspirin: {
    rxcui: '1191',
    name: 'Aspirin',
    synonym: 'Acetylsalicylic Acid',
    fullGenericName: 'Aspirin',
    brandName: 'Bayer',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
  omeprazole: {
    rxcui: '7646',
    name: 'Omeprazole',
    synonym: 'Omeprazole',
    fullGenericName: 'Omeprazole',
    brandName: 'Prilosec',
    route: 'Oral',
    doseFormGroupName: 'Capsule',
    isValid: true,
  },
  ciprofloxacin: {
    rxcui: '2551',
    name: 'Ciprofloxacin',
    synonym: 'Ciprofloxacin Hydrochloride',
    fullGenericName: 'Ciprofloxacin Hydrochloride',
    brandName: 'Cipro',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
  atorvastatin: {
    rxcui: '83367',
    name: 'Atorvastatin',
    synonym: 'Atorvastatin Calcium',
    fullGenericName: 'Atorvastatin Calcium',
    brandName: 'Lipitor',
    route: 'Oral',
    doseFormGroupName: 'Tablet',
    isValid: true,
  },
};

/**
 * Service for validating medication names and retrieving standardized
 * drug information from the RxNorm REST API (or a mock fallback).
 */
export class DrugValidationService {
  /**
   * Validate a medication name against the RxNorm API and retrieve
   * standardized drug information.
   *
   * @param medicationName - The medication name to validate
   * @returns Standardized drug information
   * @throws ApiError with 400 status if the medication name is not recognized
   */
  static async validateAndGetDrugInfo(medicationName: string): Promise<DrugInfo> {
    const baseUrl = env.RXNORM_API_BASE_URL;

    // Use mock data if configured or if the API base URL is set to 'mock'
    if (baseUrl === 'mock') {
      return DrugValidationService.getMockDrugInfo(medicationName);
    }

    try {
      return await DrugValidationService.fetchFromRxNorm(medicationName, baseUrl);
    } catch (error) {
      // If it's already an ApiError (e.g. not found), re-throw it
      if (error instanceof ApiError) {
        throw error;
      }

      // If the external API is unreachable, fall back to mock data
      logger.warn(
        `RxNorm API unavailable, falling back to mock data for: ${medicationName}`
      );
      return DrugValidationService.getMockDrugInfo(medicationName);
    }
  }

  /**
   * Fetch drug information from the live RxNorm REST API.
   *
   * @param medicationName - The medication name to look up
   * @param baseUrl - RxNorm API base URL
   * @returns Standardized drug information
   */
  private static async fetchFromRxNorm(
    medicationName: string,
    baseUrl: string
  ): Promise<DrugInfo> {
    // Step 1: Search for the drug by name to get the RxCUI
    const searchResponse = await axios.get(`${baseUrl}/drugs.json`, {
      params: { name: medicationName },
      timeout: 5000,
    });

    const drugGroup = searchResponse.data?.drugGroup;
    if (
      !drugGroup ||
      !drugGroup.conceptGroup ||
      drugGroup.conceptGroup.length === 0
    ) {
      throw ApiError.badRequest(
        `Medication "${medicationName}" not found in the RxNorm drug database. Please verify the medication name.`
      );
    }

    // Find the first concept group that has concept properties
    let drugConcept: any = null;
    for (const group of drugGroup.conceptGroup) {
      if (group.conceptProperties && group.conceptProperties.length > 0) {
        drugConcept = group.conceptProperties[0];
        break;
      }
    }

    if (!drugConcept) {
      throw ApiError.badRequest(
        `Medication "${medicationName}" not found in the RxNorm drug database. Please verify the medication name.`
      );
    }

    return {
      rxcui: drugConcept.rxcui || '',
      name: drugConcept.name || medicationName,
      synonym: drugConcept.synonym || '',
      fullGenericName: drugConcept.name || '',
      brandName: drugConcept.name || '',
      route: drugConcept.tty || '',
      doseFormGroupName: drugConcept.tty || '',
      isValid: true,
    };
  }

  /**
   * Look up drug information from the built-in mock database.
   *
   * @param medicationName - The medication name to look up
   * @returns Standardized drug information
   * @throws ApiError with 400 status if not found in mock database
   */
  private static getMockDrugInfo(medicationName: string): DrugInfo {
    const normalized = medicationName.toLowerCase().trim();
    const drugInfo = MOCK_DRUG_DATABASE[normalized];

    if (!drugInfo) {
      throw ApiError.badRequest(
        `Medication "${medicationName}" not found in the drug database. ` +
          `Available medications in mock mode: ${Object.keys(MOCK_DRUG_DATABASE).join(', ')}`
      );
    }

    return drugInfo;
  }
}
