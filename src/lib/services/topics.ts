/**
 * Topics Service
 * Provides random topics for arena comparisons
 * Uses Wikipedia's random article API with a curated fallback list
 */

import { getRandomWikipediaTopics } from './content';

/**
 * Large curated list of interesting, substantive topics
 * Used as fallback when Wikipedia API fails
 */
export const CURATED_TOPICS = [
  // Science & Technology
  'Artificial Intelligence', 'Machine Learning', 'Quantum Computing', 'Blockchain Technology',
  'CRISPR Gene Editing', 'Nuclear Fusion', 'Renewable Energy', 'Climate Change',
  'Black Holes', 'Dark Matter', 'String Theory', 'Quantum Entanglement',
  'Nanotechnology', 'Biotechnology', 'Cybersecurity', 'Cryptography',
  'Neural Networks', 'Computer Vision', 'Natural Language Processing', 'Robotics',
  'Internet of Things', 'Cloud Computing', '5G Technology', 'Virtual Reality',
  'Augmented Reality', 'Space Exploration', 'Mars Colonization', 'Asteroid Mining',
  'Gravitational Waves', 'Higgs Boson', 'Antimatter', 'Superconductivity',
  'Stem Cell Research', 'Vaccines', 'Antibiotics', 'Genetic Engineering',
  'Photosynthesis', 'Evolution', 'DNA', 'RNA', 'Protein Folding',
  'Plate Tectonics', 'Volcanoes', 'Earthquakes', 'Tsunamis', 'Hurricanes',
  'Solar System', 'Exoplanets', 'Galaxies', 'Nebulae', 'Supernovae',
  
  // History
  'Ancient Egypt', 'Roman Empire', 'Ancient Greece', 'Byzantine Empire',
  'Medieval Europe', 'The Renaissance', 'Industrial Revolution', 'French Revolution',
  'American Revolution', 'World War I', 'World War II', 'The Cold War',
  'Vietnam War', 'Korean War', 'Civil Rights Movement', 'Space Race',
  'Ancient China', 'Mongol Empire', 'Ottoman Empire', 'British Empire',
  'Silk Road', 'Age of Exploration', 'Colonialism', 'Decolonization',
  'The Enlightenment', 'Scientific Revolution', 'Protestant Reformation', 'Crusades',
  'Black Death', 'Spanish Flu', 'Fall of Constantinople', 'Fall of Rome',
  'Viking Age', 'Feudalism', 'Samurai', 'Aztec Empire', 'Inca Empire',
  'Maya Civilization', 'Mesopotamia', 'Indus Valley Civilization', 'Bronze Age',
  'Iron Age', 'Stone Age', 'Neolithic Revolution', 'Agricultural Revolution',
  
  // Philosophy & Religion
  'Stoicism', 'Existentialism', 'Nihilism', 'Utilitarianism',
  'Platonism', 'Aristotelian Philosophy', 'Kantian Ethics', 'Phenomenology',
  'Buddhism', 'Hinduism', 'Islam', 'Christianity', 'Judaism',
  'Confucianism', 'Taoism', 'Shintoism', 'Zoroastrianism',
  'Free Will', 'Determinism', 'Consciousness', 'Mind-Body Problem',
  'Ethics', 'Metaphysics', 'Epistemology', 'Logic',
  
  // Arts & Culture
  'Renaissance Art', 'Impressionism', 'Surrealism', 'Abstract Expressionism',
  'Baroque Music', 'Classical Music', 'Jazz', 'Blues', 'Rock and Roll',
  'Hip Hop', 'Electronic Music', 'Opera', 'Symphony',
  'Shakespeare', 'Greek Tragedy', 'Modern Literature', 'Postmodern Literature',
  'Film Noir', 'Documentary Film', 'Animation', 'Cinema',
  'Architecture', 'Gothic Architecture', 'Art Deco', 'Modernist Architecture',
  'Photography', 'Sculpture', 'Pottery', 'Calligraphy',
  
  // Geography & Nature
  'Amazon Rainforest', 'Great Barrier Reef', 'Sahara Desert', 'Antarctica',
  'Mount Everest', 'Grand Canyon', 'Niagara Falls', 'Victoria Falls',
  'Pacific Ocean', 'Atlantic Ocean', 'Mediterranean Sea', 'Amazon River',
  'Nile River', 'Coral Reefs', 'Tropical Rainforests', 'Tundra',
  'Biodiversity', 'Endangered Species', 'Conservation', 'Ecosystems',
  'Migration Patterns', 'Marine Biology', 'Ornithology', 'Entomology',
  
  // Social Sciences
  'Democracy', 'Capitalism', 'Socialism', 'Communism',
  'Globalization', 'International Relations', 'Diplomacy', 'Human Rights',
  'Psychology', 'Sociology', 'Anthropology', 'Economics',
  'Game Theory', 'Behavioral Economics', 'Cognitive Science', 'Linguistics',
  'Urban Planning', 'Public Health', 'Education Systems', 'Criminal Justice',
  
  // Medicine & Health
  'Cardiovascular System', 'Nervous System', 'Immune System', 'Digestive System',
  'Cancer Research', 'Alzheimer Disease', 'Diabetes', 'Heart Disease',
  'Mental Health', 'Depression', 'Anxiety Disorders', 'Schizophrenia',
  'Nutrition', 'Exercise Physiology', 'Sleep Science', 'Aging',
  'Pharmacology', 'Surgery', 'Radiology', 'Epidemiology',
  
  // Mathematics
  'Calculus', 'Linear Algebra', 'Number Theory', 'Topology',
  'Game Theory', 'Probability Theory', 'Statistics', 'Cryptography',
  'Prime Numbers', 'Infinity', 'Fractals', 'Chaos Theory',
  'Euclidean Geometry', 'Non-Euclidean Geometry', 'Graph Theory', 'Set Theory',
  
  // Animals
  'Elephants', 'Whales', 'Dolphins', 'Great Apes',
  'Lions', 'Tigers', 'Bears', 'Wolves',
  'Eagles', 'Penguins', 'Hummingbirds', 'Owls',
  'Sharks', 'Octopuses', 'Jellyfish', 'Sea Turtles',
  'Bees', 'Butterflies', 'Ants', 'Spiders',
  'Dinosaurs', 'Woolly Mammoth', 'Saber-toothed Cat', 'Dodo',
  
  // Food & Agriculture
  'Coffee', 'Tea', 'Chocolate', 'Wine',
  'Bread', 'Rice', 'Pasta', 'Cheese',
  'Fermentation', 'Organic Farming', 'Sustainable Agriculture', 'Food Security',
  'Culinary Arts', 'Food Science', 'Nutrition Science', 'Gastronomy',
  
  // Sports & Games
  'Olympic Games', 'FIFA World Cup', 'Super Bowl', 'Tour de France',
  'Chess', 'Go', 'Poker', 'Bridge',
  'Basketball', 'Football', 'Soccer', 'Tennis',
  'Golf', 'Swimming', 'Marathon Running', 'Gymnastics',
  'Martial Arts', 'Boxing', 'Wrestling', 'Fencing',
  
  // Modern Topics
  'Social Media', 'Streaming Services', 'E-commerce', 'Cryptocurrency',
  'Electric Vehicles', 'Autonomous Vehicles', 'Drones', 'Smart Cities',
  'Remote Work', 'Gig Economy', 'Startup Culture', 'Venture Capital',
  'Misinformation', 'Digital Privacy', 'Net Neutrality', 'Open Source Software',
  
  // Structures & Engineering
  'Great Wall of China', 'Pyramids of Giza', 'Colosseum', 'Parthenon',
  'Eiffel Tower', 'Statue of Liberty', 'Golden Gate Bridge', 'Panama Canal',
  'Hoover Dam', 'Burj Khalifa', 'International Space Station', 'Large Hadron Collider',
  
  // Miscellaneous Interesting Topics
  'Dreams', 'Memory', 'Intelligence', 'Creativity',
  'Happiness', 'Love', 'Friendship', 'Trust',
  'Time', 'Space', 'Energy', 'Matter',
  'Colors', 'Sound', 'Light', 'Gravity',
  'Languages', 'Writing Systems', 'Alphabets', 'Translation',
  'Mythology', 'Folklore', 'Legends', 'Fairy Tales',
  'Magic', 'Illusions', 'Puzzles', 'Riddles',
];

/**
 * Get a random topic for arena comparison
 * Tries Wikipedia API first, falls back to curated list
 */
export async function getRandomTopic(): Promise<string> {
  try {
    // Try to get a random topic from Wikipedia
    const topics = await getRandomWikipediaTopics(1);
    if (topics.length > 0) {
      return topics[0];
    }
  } catch (e) {
    console.error('Failed to get Wikipedia random topic:', e);
  }
  
  // Fall back to curated list
  return CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)];
}

/**
 * Get multiple random topics
 * Uses Wikipedia API with curated list fallback
 */
export async function getRandomTopics(count: number): Promise<string[]> {
  const topics: string[] = [];
  
  try {
    // Try to get topics from Wikipedia
    const wikiTopics = await getRandomWikipediaTopics(count);
    topics.push(...wikiTopics);
  } catch (e) {
    console.error('Failed to get Wikipedia random topics:', e);
  }
  
  // Fill remaining slots with curated topics
  const shuffledCurated = [...CURATED_TOPICS].sort(() => Math.random() - 0.5);
  let curatedIndex = 0;
  
  while (topics.length < count && curatedIndex < shuffledCurated.length) {
    const topic = shuffledCurated[curatedIndex];
    if (!topics.includes(topic)) {
      topics.push(topic);
    }
    curatedIndex++;
  }
  
  return topics.slice(0, count);
}

/**
 * Get a random curated topic (no API call)
 * Useful for quick fallback or offline mode
 */
export function getRandomCuratedTopic(): string {
  return CURATED_TOPICS[Math.floor(Math.random() * CURATED_TOPICS.length)];
}

/**
 * Search curated topics
 */
export function searchCuratedTopics(query: string, limit = 10): string[] {
  const lowerQuery = query.toLowerCase();
  return CURATED_TOPICS
    .filter(topic => topic.toLowerCase().includes(lowerQuery))
    .slice(0, limit);
}
