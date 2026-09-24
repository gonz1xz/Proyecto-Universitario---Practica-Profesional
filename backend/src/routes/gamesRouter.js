import { Router } from 'express';


const router = Router();


// Busqueda del juego por nombre
router.get('/', async (req, res) => {
  const gameName = req.query.search;

  if (!gameName) {
    return res.status(400).json({ error: 'Missing search query parameter' });
  }

  const url = new URL(`https://api.isthereanydeal.com/games/search/v1`);
  url.searchParams.append('title', gameName);
  url.searchParams.append('results', 10);

  const config = {
    headers: {
      'ITAD-API-Key': process.env.ITAD_API_KEY,
      'content-type': 'application/json',
    },
  }

  try {
    const response = await fetch(url, config);
    if (!response.ok) { return res.status(response.status).json({ error: 'Failed to fetch game data' }) }

    const games = await response.json();

    res.json(games);

  } catch (error) {

    console.error('Error fetching game data:', error);
    res.status(500).json({ error: 'Failed to fetch game data' });

  }

});

// Informacion sobre el precio del juego por id
router.get('/:id/prices', async (req, res) => {
  const gameId = req.params.id;

  const url = new URL(`https://api.isthereanydeal.com/games/prices/v3`);

  url.searchParams.append('country', 'US');

  const config = {
    headers: {
      'ITAD-API-Key': process.env.ITAD_API_KEY,
      'content-type': 'application/json',
    },
  }

  const payload = [gameId];


  try {
    const response = await fetch(url, {
      ...config,
      method: 'POST',
      body: JSON.stringify(payload)
    });
    if (!response.ok) { return res.status(response.status).json({ error: 'Failed to fetch game data' }) }
    const game = await response.json();
    res.json(game);
  } catch (error) {
    console.error('Error fetching game data:', error);
    res.status(500).json({ error: 'Failed to fetch game data' });
  }

})





export default router;