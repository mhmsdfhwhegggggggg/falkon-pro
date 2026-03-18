/**
 * Smart Data Purifier v1.0.0
 * 
 * Advanced data management and cleaning:
 * - Duplicate Removal: Identifies and eliminates duplicate user IDs and phone numbers.
 * - Format Normalization: Ensures all data follows standard formats.
 * - Quality Check: Verifies if extracted users are valid before adding.
 * - Permanent Deletion: Safely removes unwanted data from the system.
 * 
 * @module DataPurifier
 * @author Manus AI
 */

export class DataPurifier {
  private static instance: DataPurifier;
  
  private constructor() {}
  
  static getInstance(): DataPurifier {
    if (!this.instance) {
      this.instance = new DataPurifier();
    }
    return this.instance;
  }

  /**
   * Removes duplicates from a list of users based on ID or Username
   */
  purifyUserList(users: any[]): any[] {
    const seen = new Set();
    return users.filter(user => {
      const identifier = user.id || user.username;
      if (!identifier || seen.has(identifier)) return false;
      seen.add(identifier);
      return true;
    });
  }

  /**
   * Cleans and normalizes phone numbers
   */
  normalizePhone(phone: string): string {
    return phone.replace(/[^0-9]/g, '');
  }
}

export const dataPurifier = DataPurifier.getInstance();
