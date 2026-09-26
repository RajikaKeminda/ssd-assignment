import mongoose from 'mongoose';
import { PharmacyService } from '../../services/pharmacy.service';
import { Pharmacy } from '../../models/pharmacy.model';
import { Review } from '../../models/review.model';
import { ApiError } from '../../utils/api-error';
import { GeocodingService } from '../../services/geocoding.service';
import {
  connectTestDB,
  disconnectTestDB,
  clearTestDB,
} from '../helpers/db.helper';
import {
  createTestUser,
  createPharmacyStaff,
  createSystemAdmin,
} from '../helpers/test-data.helper';
import { CreatePharmacyInput } from '@validators/pharmacy.validator';

describe('PharmacyService', () => {
  beforeAll(async () => {
    await connectTestDB();
  });

  afterAll(async () => {
    await disconnectTestDB();
  });

  beforeEach(async () => {
    await clearTestDB();
  });

  const buildOperatingHours = () => ({
    monday: { open: '09:00', close: '17:00', isClosed: false },
    tuesday: { open: '09:00', close: '17:00', isClosed: false },
    wednesday: { open: '09:00', close: '17:00', isClosed: false },
    thursday: { open: '09:00', close: '17:00', isClosed: false },
    friday: { open: '09:00', close: '17:00', isClosed: false },
    saturday: { open: '09:00', close: '13:00', isClosed: false },
    sunday: { open: '00:00', close: '00:00', isClosed: true },
  });

  const baseCreatePayload = () => ({
    name: 'Central Pharmacy',
    licenseNumber: 'LIC-12345',
    location: {
      address: '123 Main Street',
      city: 'Colombo',
      province: 'Western',
      postalCode: '10100',
    },
    contactInfo: {
      phone: '+94771234567',
      email: 'central@pharmacy.com',
      website: 'https://central-pharmacy.com',
      emergencyContact: '+94770000000',
    },
    operatingHours: buildOperatingHours(),
    serviceRadius: 5,
    facilityType: 'retail' as const,
    services: ['24/7 service', 'Home delivery'],
    images: ['https://example.com/image1.jpg'],
    certifications: ['SLMC-123'],
  });

  describe('createPharmacy', () => {
    it('should create a pharmacy for a staff owner with geocoded location', async () => {
      const staff = await createPharmacyStaff();

      const payload = baseCreatePayload();

      const geoSpy = jest.spyOn(GeocodingService, 'geocodeAddress');

      const pharmacy = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        staff._id.toString()
      );

      expect(pharmacy).toBeDefined();
      expect(pharmacy.name).toBe('Central Pharmacy');
      expect(pharmacy.licenseNumber).toBe('LIC-12345');
      expect(pharmacy.ownerId.toString()).toBe(staff._id.toString());
      expect(pharmacy.location.city).toBe('Colombo');
      expect(pharmacy.geoLocation.type).toBe('Point');
      expect(pharmacy.geoLocation.coordinates).toHaveLength(2);

      expect(geoSpy).toHaveBeenCalledWith(
        payload.location.address,
        payload.location.city,
        payload.location.province,
        payload.location.postalCode
      );

      geoSpy.mockRestore();
    });

    it('should throw conflict when license number already exists', async () => {
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      await PharmacyService.createPharmacy(payload as CreatePharmacyInput, staff._id.toString());

      await expect(
        PharmacyService.createPharmacy(payload as CreatePharmacyInput, staff._id.toString())
      ).rejects.toThrow('A pharmacy with this license number already exists');
    });

    it('should prevent same owner from creating multiple active pharmacies', async () => {
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      await PharmacyService.createPharmacy(payload as CreatePharmacyInput, staff._id.toString());

      const secondPayload = {
        ...baseCreatePayload(),
        name: 'Branch Pharmacy',
        licenseNumber: 'LIC-67890',
      } as CreatePharmacyInput;

      await expect(
        PharmacyService.createPharmacy(secondPayload as CreatePharmacyInput, staff._id.toString())
      ).rejects.toThrow('This user already owns an active pharmacy');
    });
  });

  describe('getPharmacies', () => {
    beforeEach(async () => {
      const owner = await createPharmacyStaff();

      await Pharmacy.create({
        name: 'Verified Colombo Pharmacy',
        licenseNumber: 'LIC-0001',
        location: {
          address: '1 Main Street',
          city: 'Colombo',
          province: 'Western',
          postalCode: '10100',
          coordinates: { latitude: 6.9271, longitude: 79.8612 },
        },
        contactInfo: {
          phone: '+94770000001',
          email: 'colombo@pharmacy.com',
        },
        operatingHours: buildOperatingHours(),
        serviceRadius: 10,
        isVerified: true,
        verificationDate: new Date(),
        rating: 4.5,
        totalReviews: 10,
        ownerId: owner._id,
        facilityType: 'retail',
        services: [],
        images: [],
        certifications: [],
        isActive: true,
        geoLocation: {
          type: 'Point',
          coordinates: [79.8612, 6.9271],
        },
      });

      await Pharmacy.create({
        name: 'Unverified Kandy Pharmacy',
        licenseNumber: 'LIC-0002',
        location: {
          address: '2 High Street',
          city: 'Kandy',
          province: 'Central',
          postalCode: '20000',
          coordinates: { latitude: 7.2906, longitude: 80.6337 },
        },
        contactInfo: {
          phone: '+94770000002',
          email: 'kandy@pharmacy.com',
        },
        operatingHours: buildOperatingHours(),
        serviceRadius: 8,
        isVerified: false,
        rating: 0,
        totalReviews: 0,
        ownerId: owner._id,
        facilityType: 'retail',
        services: [],
        images: [],
        certifications: [],
        isActive: true,
        geoLocation: {
          type: 'Point',
          coordinates: [80.6337, 7.2906],
        },
      });
    });

    it('should return paginated pharmacies with default query', async () => {
      const result = await PharmacyService.getPharmacies({
        page: '1',
        limit: '10',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items.length).toBe(2);
      expect(result.total).toBe(2);
      expect(result.page).toBe(1);
      expect(result.pages).toBe(1);
    });

    it('should filter pharmacies by city and verification status', async () => {
      const result = await PharmacyService.getPharmacies({
        city: 'Colombo',
        isVerified: true,
        page: '1',
        limit: '10',
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result.items.length).toBe(1);
      expect(result.items[0].location.city).toBe('Colombo');
      expect(result.items[0].isVerified).toBe(true);
    });
  });

  describe('getPharmacyById', () => {
    it('should return active pharmacy by id', async () => {
      const owner = await createPharmacyStaff();

      const created = await Pharmacy.create({
        name: 'Active Pharmacy',
        licenseNumber: 'LIC-0100',
        location: {
          address: '123 Active St',
          city: 'Galle',
          province: 'Southern',
          postalCode: '80000',
          coordinates: { latitude: 6.0535, longitude: 80.221 },
        },
        contactInfo: {
          phone: '+94770000003',
          email: 'active@pharmacy.com',
        },
        operatingHours: buildOperatingHours(),
        serviceRadius: 5,
        isVerified: false,
        rating: 0,
        totalReviews: 0,
        ownerId: owner._id,
        facilityType: 'retail',
        services: [],
        images: [],
        certifications: [],
        isActive: true,
        geoLocation: {
          type: 'Point',
          coordinates: [80.221, 6.0535],
        },
      });

      const result = await PharmacyService.getPharmacyById(
        created._id.toString()
      );

      expect(result._id.toString()).toBe(created._id.toString());
      expect(result.name).toBe('Active Pharmacy');
    });

    it('should throw not found for inactive or missing pharmacy', async () => {
      const owner = await createPharmacyStaff();

      const created = await Pharmacy.create({
        name: 'Inactive Pharmacy',
        licenseNumber: 'LIC-0101',
        location: {
          address: '123 Inactive St',
          city: 'Matara',
          province: 'Southern',
          postalCode: '81000',
          coordinates: { latitude: 5.9485, longitude: 80.5428 },
        },
        contactInfo: {
          phone: '+94770000004',
          email: 'inactive@pharmacy.com',
        },
        operatingHours: buildOperatingHours(),
        serviceRadius: 5,
        isVerified: false,
        rating: 0,
        totalReviews: 0,
        ownerId: owner._id,
        facilityType: 'retail',
        services: [],
        images: [],
        certifications: [],
        isActive: false,
        geoLocation: {
          type: 'Point',
          coordinates: [80.5428, 5.9485],
        },
      });

      await expect(
        PharmacyService.getPharmacyById(created._id.toString())
      ).rejects.toThrow('Pharmacy not found');

      const fakeId = new mongoose.Types.ObjectId().toString();
      await expect(PharmacyService.getPharmacyById(fakeId)).rejects.toThrow(
        'Pharmacy not found'
      );
    });
  });

  describe('updatePharmacy', () => {
    it('should allow owner to update pharmacy details and re-geocode when location changes', async () => {
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      const created = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        staff._id.toString()
      );

      const updated = await PharmacyService.updatePharmacy(
        created._id.toString(),
        {
          name: 'Updated Pharmacy',
          location: {
            address: '456 New Street',
            city: 'Kandy',
            province: 'Central',
            postalCode: '20000',
          },
        },
        staff._id.toString(),
        'Pharmacy Staff'
      );

      expect(updated.name).toBe('Updated Pharmacy');
      expect(updated.location.city).toBe('Kandy');
      expect(updated.geoLocation.coordinates).toHaveLength(2);
    });

    it('should allow system admin to update any pharmacy', async () => {
      const staff = await createPharmacyStaff();
      const admin = await createSystemAdmin();
      const payload = baseCreatePayload();

      const created = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        staff._id.toString()
      );

      const updated = await PharmacyService.updatePharmacy(
        created._id.toString(),
        { serviceRadius: 15 },
        admin._id.toString(),
        'System Admin'
      );

      expect(updated.serviceRadius).toBe(15);
    });

    it('should throw forbidden when non-owner, non-admin tries to update', async () => {
      const owner = await createPharmacyStaff();
      const otherStaff = await createPharmacyStaff({
        email: 'other-staff@pharmacy.com',
      });
      const payload = baseCreatePayload();

      const created = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        owner._id.toString()
      );

      await expect(
        PharmacyService.updatePharmacy(
          created._id.toString(),
          { name: 'Hacked Name' },
          otherStaff._id.toString(),
          'Pharmacy Staff'
        )
      ).rejects.toThrow(
        'You do not have permission to update this pharmacy'
      );
    });
  });

  describe('verifyPharmacy', () => {
    it('should mark pharmacy as verified and set verification date', async () => {
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      const created = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        staff._id.toString()
      );

      const verified = await PharmacyService.verifyPharmacy(
        created._id.toString()
      );

      expect(verified.isVerified).toBe(true);
      expect(verified.verificationDate).toBeInstanceOf(Date);
    });

    it('should throw not found when pharmacy does not exist', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      await expect(
        PharmacyService.verifyPharmacy(fakeId)
      ).rejects.toThrow('Pharmacy not found');
    });
  });

  describe('deactivatePharmacy', () => {
    it('should allow owner to deactivate pharmacy', async () => {
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      const created = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        staff._id.toString()
      );

      const deactivated = await PharmacyService.deactivatePharmacy(
        created._id.toString(),
        staff._id.toString(),
        'Pharmacy Staff'
      );

      expect(deactivated.isActive).toBe(false);
    });

    it('should allow system admin to deactivate pharmacy', async () => {
      const staff = await createPharmacyStaff();
      const admin = await createSystemAdmin();
      const payload = baseCreatePayload();

      const created = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        staff._id.toString()
      );

      const deactivated = await PharmacyService.deactivatePharmacy(
        created._id.toString(),
        admin._id.toString(),
        'System Admin'
      );

      expect(deactivated.isActive).toBe(false);
    });

    it('should throw forbidden when non-owner, non-admin tries to deactivate', async () => {
      const owner = await createPharmacyStaff();
      const otherStaff = await createPharmacyStaff({
        email: 'other-staff@pharmacy.com',
      });
      const payload = baseCreatePayload();

      const created = await PharmacyService.createPharmacy(
        payload as CreatePharmacyInput,
        owner._id.toString()
      );

      await expect(
        PharmacyService.deactivatePharmacy(
          created._id.toString(),
          otherStaff._id.toString(),
          'Pharmacy Staff'
        )
      ).rejects.toThrow(
        'You do not have permission to deactivate this pharmacy'
      );
    });
  });

  describe('findNearbyPharmacies', () => {
    it('should return only verified active pharmacies within radius', async () => {
      const owner = await createPharmacyStaff();

      // Within 5km (approx)
      await Pharmacy.create({
        name: 'Nearby Verified',
        licenseNumber: 'LIC-N1',
        location: {
          address: '1 Nearby Street',
          city: 'Colombo',
          province: 'Western',
          postalCode: '10100',
          coordinates: { latitude: 6.9271, longitude: 79.8612 },
        },
        contactInfo: {
          phone: '+94770000005',
          email: 'nearby@pharmacy.com',
        },
        operatingHours: buildOperatingHours(),
        serviceRadius: 5,
        isVerified: true,
        verificationDate: new Date(),
        rating: 4.8,
        totalReviews: 5,
        ownerId: owner._id,
        facilityType: 'retail',
        services: [],
        images: [],
        certifications: [],
        isActive: true,
        geoLocation: {
          type: 'Point',
          coordinates: [79.8612, 6.9271],
        },
      });

      // Far away
      await Pharmacy.create({
        name: 'Far Away',
        licenseNumber: 'LIC-F1',
        location: {
          address: '100 Distant Street',
          city: 'Jaffna',
          province: 'Northern',
          postalCode: '40000',
          coordinates: { latitude: 9.6615, longitude: 80.0255 },
        },
        contactInfo: {
          phone: '+94770000006',
          email: 'far@pharmacy.com',
        },
        operatingHours: buildOperatingHours(),
        serviceRadius: 5,
        isVerified: true,
        verificationDate: new Date(),
        rating: 4.0,
        totalReviews: 2,
        ownerId: owner._id,
        facilityType: 'retail',
        services: [],
        images: [],
        certifications: [],
        isActive: true,
        geoLocation: {
          type: 'Point',
          coordinates: [80.0255, 9.6615],
        },
      });

      const nearby = await PharmacyService.findNearbyPharmacies({
        latitude: 6.9271,
        longitude: 79.8612,
        radiusKm: 10,
      });

      expect(nearby.length).toBe(1);
      expect(nearby[0].name).toBe('Nearby Verified');
    });
  });

  describe('addReview & getReviews', () => {
    it('should allow patient to add first review and update pharmacy rating', async () => {
      const patient = await createTestUser();
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      const pharmacy = await PharmacyService.createPharmacy(
        { ...payload, licenseNumber: 'LIC-R1' } as CreatePharmacyInput,
        staff._id.toString()
      );

      // Mark as verified so reviews are allowed
      await PharmacyService.verifyPharmacy(pharmacy._id.toString());

      const review = await PharmacyService.addReview(
        pharmacy._id.toString(),
        patient._id.toString(),
        {
          rating: 5,
          comment: 'Excellent service',
          serviceQuality: 5,
          deliverySpeed: 4,
          productAvailability: 5,
        }
      );

      expect(review.rating).toBe(5);
      expect(review.comment).toBe('Excellent service');

      const updatedPharmacy = await Pharmacy.findById(pharmacy._id);
      expect(updatedPharmacy!.totalReviews).toBe(1);
      expect(updatedPharmacy!.rating).toBe(5);
    });

    it('should prevent multiple reviews from same user for a pharmacy', async () => {
      const patient = await createTestUser();
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      const pharmacy = await PharmacyService.createPharmacy(
        { ...payload, licenseNumber: 'LIC-R2' } as CreatePharmacyInput,
        staff._id.toString()
      );

      await PharmacyService.verifyPharmacy(pharmacy._id.toString());

      await PharmacyService.addReview(
        pharmacy._id.toString(),
        patient._id.toString(),
        {
          rating: 4,
          comment: 'Good service',
        }
      );

      await expect(
        PharmacyService.addReview(
          pharmacy._id.toString(),
          patient._id.toString(),
          {
            rating: 3,
            comment: 'Second review not allowed',
          }
        )
      ).rejects.toThrow('You have already reviewed this pharmacy');
    });

    it('should not allow reviews for unverified pharmacies', async () => {
      const patient = await createTestUser();
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      const pharmacy = await PharmacyService.createPharmacy(
        { ...payload, licenseNumber: 'LIC-R3' } as CreatePharmacyInput,
        staff._id.toString()
      );

      await expect(
        PharmacyService.addReview(
          pharmacy._id.toString(),
          patient._id.toString(),
          {
            rating: 4,
            comment: 'Should fail',
          }
        )
      ).rejects.toThrow('Cannot review an unverified pharmacy');
    });

    it('should paginate reviews for a pharmacy', async () => {
      const patient = await createTestUser();
      const staff = await createPharmacyStaff();
      const payload = baseCreatePayload();

      const pharmacy = await PharmacyService.createPharmacy(
        { ...payload, licenseNumber: 'LIC-R4' } as CreatePharmacyInput,
        staff._id.toString()
      );

      await PharmacyService.verifyPharmacy(pharmacy._id.toString());

      // create two reviews
      await Review.create({
        pharmacyId: pharmacy._id,
        userId: patient._id,
        rating: 5,
        comment: 'First review',
        serviceQuality: 5,
        deliverySpeed: 5,
        productAvailability: 5,
      });

      await Review.create({
        pharmacyId: pharmacy._id,
        userId: new mongoose.Types.ObjectId(),
        rating: 4,
        comment: 'Second review',
        serviceQuality: 4,
        deliverySpeed: 4,
        productAvailability: 4,
      });

      const result = await PharmacyService.getReviews(
        pharmacy._id.toString(),
        {
          page: '1',
          limit: '1',
          sortOrder: 'desc',
        }
      );

      expect(result.items.length).toBe(1);
      expect(result.total).toBe(2);
      expect(result.pages).toBe(2);
    });

    it('should throw not found when getting reviews for non-existent pharmacy', async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();

      await expect(
        PharmacyService.getReviews(fakeId, {
          page: '1',
          limit: '10',
          sortOrder: 'desc',
        })
      ).rejects.toThrow('Pharmacy not found');
    });
  });
});

