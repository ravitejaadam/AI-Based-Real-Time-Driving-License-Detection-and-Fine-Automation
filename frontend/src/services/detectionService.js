export async function detectFrame(imageData, sourceType) {
  try {
    const response = await fetch('http://127.0.0.1:5000/api/detect', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData, sourceType }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Detection service error: ${response.status} ${errorText}`);
    }

    return response.json();
  } catch (error) {
    console.error('Detection service request failed:', error);
    throw error;
  }
}
