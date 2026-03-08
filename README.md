# Lowdine — The Speakeasy Dinner Decider

Lowdine is a mobile-first web application designed to solve one of the most common social dilemmas: deciding where to eat.

Instead of scrolling endlessly through restaurant lists, users spin a roulette-style wheel that randomly selects a restaurant. The experience is designed to make decision-making fast, playful, and social.

The interface uses a speakeasy-inspired theme and animated wheel interactions to turn restaurant selection into a small moment of entertainment.

---

## Why This Exists

Choosing where to eat is a surprisingly common source of friction.

Typical experiences involve:

- endless scrolling through restaurant apps
- decision fatigue between multiple options
- group indecision when dining with others

Lowdine reframes the problem as a game: spin the wheel and let randomness decide.

---

## Core Idea

Lowdine acts as a **decision engine for nearby restaurants**.

Users provide their location, the system gathers nearby dining options, and a roulette wheel selects a destination.

```
User location
↓
Restaurant discovery
↓
Candidate restaurant list
↓
Roulette wheel selection
↓
Selected restaurant
```


---

## Key Features

### Restaurant Discovery
Find nearby restaurants based on the user's location.

### Roulette Selection
Restaurants are placed on a wheel and randomly selected using a spinning animation.

### "Double or Muffin"
A playful option that allows users to spin again and try their luck.

### Mobile-First Design
The interface is optimized for quick interactions on mobile devices.

### Animated UI
Smooth animations using Framer Motion enhance the wheel interaction.

---

## Screenshot

*(Add a screenshot here once available)*


---

## Technology Stack

### Frontend
- Next.js (App Router)
- TypeScript

### UI
- Tailwind CSS
- Framer Motion
- React Icons

### Mapping (planned)
- Leaflet
- OpenStreetMap / Overpass API

---

## Development Setup

Install dependencies:

```bash
npm install
```

# Future Enhancements

- Restaurant discovery via OpenStreetMap Overpass API
- Cuisine and price filtering
- Saved restaurant lists
- Navigation integration
- Group decision mode

# Project Status
Active prototype.

The project explores playful UI patterns for reducing decision fatigue in everyday choices.

# License
MIT
