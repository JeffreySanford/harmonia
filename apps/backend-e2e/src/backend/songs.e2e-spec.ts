import axios from 'axios';

describe('POST /api/songs/generate-metadata', () => {
  it('should return generated or fallback metadata', async () => {
    const res = await axios.post('/api/songs/generate-metadata', {
      narrative: 'A short story about rain and morning',
      duration: 45,
      model: 'minstral3',
    });

    expect(res.status).toBe(200);
    const data = res.data;
    expect(data).toHaveProperty('title');
    expect(data).toHaveProperty('lyrics');
    expect(data).toHaveProperty('genre');
    expect(data).toHaveProperty('mood');
  });
});
