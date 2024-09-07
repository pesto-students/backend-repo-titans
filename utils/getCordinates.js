import axios from 'axios';

export async function getCordinates(shortUrl) {
  try {
    // console.log("short url "+ shortUrl);
    const response = await axios.head(shortUrl, { maxRedirects: 10 });
    const expandedUrl = response.request.res.responseUrl;
    // console.log('Expanded URL:', expandedUrl);
    return extractLatLongFromUrl(expandedUrl);
  } catch (error) {
    console.error('Error expanding URL:', error);
    throw error;
  }
}

const extractLatLongFromUrl = (url) => {
  try {
    const regex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const match = url.match(regex);
    if (match && match.length >= 3) {
      const latitude = parseFloat(match[1]);
      const longitude = parseFloat(match[2]);
      // console.log(latitude);
      // console.log(longitude);
      return { latitude, longitude };
    } else {
      return { error: 'Latitude and longitude not found in the URL' };
    }
  } catch (error) {
    return { error: 'An error occurred while extracting coordinates' };
  }
};
