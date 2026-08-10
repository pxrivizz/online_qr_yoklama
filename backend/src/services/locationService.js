/**
 * Location and network validation service
 */

/**
 * Calculate distance in meters between two GPS coordinates using Haversine formula
 * @param {number} lat1 - First latitude
 * @param {number} lon1 - First longitude
 * @param {number} lat2 - Second latitude
 * @param {number} lon2 - Second longitude
 * @returns {number} Distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 * @private
 */
function toRad(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Check if student location is within allowed radius
 * @param {number} studentLat - Student latitude
 * @param {number} studentLon - Student longitude
 * @param {number} allowedLat - Allowed latitude center
 * @param {number} allowedLon - Allowed longitude center
 * @param {number} radiusMeters - Radius in meters
 * @returns {Object} { valid: boolean, distance: number }
 */
function isWithinAllowedLocation(
  studentLat,
  studentLon,
  allowedLat,
  allowedLon,
  radiusMeters
) {
  const distance = calculateDistance(
    studentLat,
    studentLon,
    allowedLat,
    allowedLon
  );
  return {
    valid: distance <= radiusMeters,
    distance: Math.round(distance),
  };
}

/**
 * Check if IP is within allowed CIDR range
 * @param {string} studentIP - Student IP address
 * @param {string} allowedIpRange - CIDR notation (e.g. 192.168.1.0/24)
 * @returns {Object} { valid: boolean }
 */
function isWithinAllowedNetwork(studentIP, allowedIpRange) {
  // If no range specified, allow all
  if (!allowedIpRange) {
    return { valid: true };
  }

  try {
    // Parse CIDR notation
    const [network, prefixStr] = allowedIpRange.split('/');
    const prefix = parseInt(prefixStr, 10);
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > 32) return { valid: false };

    // Convert IP strings to binary
    const studentBinary = ipToBinary(studentIP);
    const networkBinary = ipToBinary(network);

    if (studentBinary === null || networkBinary === null) {
      // Invalid IP format, reject
      return { valid: false };
    }

    // Compare first 'prefix' bits
    const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
    const studentMasked = studentBinary & mask;
    const networkMasked = networkBinary & mask;

    return { valid: studentMasked === networkMasked };
  } catch (error) {
    // Invalid CIDR format, reject
    return { valid: false };
  }
}

/**
 * Convert IP address string to 32-bit integer
 * @private
 */
function ipToBinary(ipStr) {
  if (typeof ipStr !== 'string') return null;
  if (ipStr.startsWith('::ffff:')) ipStr = ipStr.slice(7);
  const parts = ipStr.split('.');
  if (parts.length !== 4) {
    return null;
  }

  let result = 0;
  for (const part of parts) {
    const num = parseInt(part, 10);
    if (isNaN(num) || num < 0 || num > 255) {
      return null;
    }
    result = (result << 8) | num;
  }

  return result >>> 0; // Convert to unsigned 32-bit integer
}

module.exports = {
  calculateDistance,
  isWithinAllowedLocation,
  isWithinAllowedNetwork,
};
