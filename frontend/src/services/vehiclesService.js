const API_BASE_URL = 'http://localhost:5000';

export async function getVehicles() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/vehicles`);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      const errorMessage = errorData?.error || errorData?.details || 'Unable to load vehicle records';
      console.error('Vehicle Query Error:', { status: response.status, error: errorMessage, details: errorData });
      throw new Error(errorMessage);
    }

    const data = await response.json();
    console.log('Vehicle Query Error:', null);
    return data;
  } catch (error) {
    console.error('API getVehicles failed:', error);
    throw error;
  }
}