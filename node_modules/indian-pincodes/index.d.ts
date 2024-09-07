declare module "indian-pincodes" {
    export interface PincodeInfo {
      name: string;
      pincode: number;
      circle: string;
      district: string;
      division: string;
      region: string;
      state: string;
      country: string;
    }
  
    export function getPincodeDetails(pincode: number): PincodeInfo | undefined;
    export function getPincodesByDistrict(district: string): PincodeInfo[];
    export function getPincodesByState(state: string): PincodeInfo[];
    export function getDistrictsByState(state: string): string[];
    export function getStates(): string[];
    export function searchPincodes(query: string): PincodeInfo[];
    export function getAllPincodes(): PincodeInfo[];
  }
  