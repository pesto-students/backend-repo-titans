import moment from 'moment';

export const sortByPrice = (gyms, order_by = 'asc') => {
  return gyms.sort((a, b) => {
      const comparison = (a.price || 0) - (b.price || 0);
      return order_by === 'asc' ? comparison : -comparison;
  });
};

// Helper function to sort by rating
export const sortByRating = (gyms, order_by = 'desc') => {
  return gyms.sort((a, b) => {
      const comparison = (b.average_rating || 0) - (a.average_rating || 0);
      return order_by === 'desc' ? -comparison : comparison;
  });
};

// Helper function to sort by time (slots)
export const sortByTime = (gyms, order_by = 'asc') => {
  const today = moment().format('dddd'); // Get current day as a string (e.g., "Monday")
  
  return gyms.sort((a, b) => {
      const slotsA = a.schedule && a.schedule.slots && a.schedule.slots[today] ? a.schedule.slots[today] : [];
      const slotsB = b.schedule && b.schedule.slots && b.schedule.slots[today] ? b.schedule.slots[today] : [];

      const slotA = slotsA.length > 0 ? slotsA[0].from : '24:00';
      const slotB = slotsB.length > 0 ? slotsB[0].from : '24:00';

      const comparison = slotA.localeCompare(slotB);
      return order_by === 'asc' ? comparison : -comparison;
  });
};

// Helper function to sort by distance (assuming distance is already calculated in gym data)
export const sortByDistance = (gyms, order_by = 'asc') => {
  return gyms.sort((a, b) => {
      const comparison = (a.distance || 0) - (b.distance || 0);
      return order_by === 'asc' ? comparison : -comparison;
  });
};