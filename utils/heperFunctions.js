import Gyms from "../models/GymSchema.js";

// Utility function to normalize day names
export const normalizeDayName = (day) => {
  // Map of standard day names
  const days = {
    'monday': 'Monday',
    'mon': 'Monday',
    'tuesday': 'Tuesday',
    'tue': 'Tuesday',
    'wednesday': 'Wednesday',
    'wed': 'Wednesday',
    'thursday': 'Thursday',
    'thu': 'Thursday',
    'friday': 'Friday',
    'fri': 'Friday',
    'saturday': 'Saturday',
    'sat': 'Saturday',
    'sunday': 'Sunday',
    'sun': 'Sunday'
  };

  // Normalize the day input to lowercase and trim whitespace
  const normalizedDay = day.trim().toLowerCase();

  // Return the normalized day name or an empty string if not found
  return days[normalizedDay] || '';
};
// Function to get distinct cities
export const getDistinctCities = (cities) => {
  const cityMap = new Map();

  cities.forEach(city => {
    if (city.name && !cityMap.has(city.name)) {
      cityMap.set(city.name, city);
    }
  });

  return Array.from(cityMap.values());
};

// Function to check if there are gyms in a city
export const getCitiesWithGyms = async (cities) => {
  const cityNames = cities.map(city => city.name);

  // Fetch gyms from the database that are located in the cities
  const gyms = await Gyms.find({ 'address.city': { $in: cityNames } }).select('address.city').lean();

  // Extract city names from gyms
  const gymCities = new Set(gyms.map(gym => gym.address.city));

  // Filter the cities array to include only those with gyms
  return cities.filter(city => gymCities.has(city.name));
};

export const validateSlots = (daySlots) => {
  const errors = [];
  const seenSlots = [];

  for (let i = 0; i < daySlots.length; i++) {
    const { from, to } = daySlots[i];

    // Check if the 'from' time is before the 'to' time
    if (from >= to) {
      errors.push(`Invalid slot: 'from' time (${from}) should be before 'to' time (${to})`);
    }

    // Check if the duration is at least one hour
    const [fromHours, fromMinutes] = from.split(':').map(Number);
    const [toHours, toMinutes] = to.split(':').map(Number);
    const durationInMinutes = (toHours * 60 + toMinutes) - (fromHours * 60 + fromMinutes);

    if (durationInMinutes < 60) {
      errors.push(`Invalid slot: The duration between 'from' (${from}) and 'to' (${to}) must be at least one hour`);
    }

    // Check for duplicate slots
    if (seenSlots.some(slot => slot.from === from && slot.to === to)) {
      errors.push(`Duplicate slot found: ${from} - ${to}`);
    }

    // Check for overlapping slots
    for (let j = 0; j < seenSlots.length; j++) {
      const existingSlot = seenSlots[j];
      if (
        (from < existingSlot.to && to > existingSlot.from) ||
        (existingSlot.from < to && existingSlot.to > from)
      ) {
        errors.push(`Overlapping slot found: ${from} - ${to} overlaps with ${existingSlot.from} - ${existingSlot.to}`);
      }
    }

    seenSlots.push({ from, to });
  }

  return errors;
};