# Portland Reuse Hub

A web platform helping Portland residents find where to donate, repair, recycle, or properly dispose of items - reducing waste through reuse and circular economy principles.

## 🎯 Project Vision

Make it easy for anyone in Portland to find the right place for any item they want to get rid of - whether that's donating usable goods, finding repair services, recycling materials, or proper disposal of hazardous waste.

## 🚀 Current Features (V1)

- **Smart Search**: Search by item name (e.g., "laptop", "couch", "paint")
- **Interactive Map**: See all locations on a Portland map
- **Category Filters**: Filter by donation, repair, recycling, or disposal
- **Location Details**: Address, hours, phone, accepted items
- **Real Portland Data**: 15 actual Portland locations to start

## 📁 Project Structure

```
portland-reuse-hub/
├── index.html          # Main page structure
├── styles.css          # All styling
├── app.js             # JavaScript logic
├── data.json          # Location database
└── README.md          # This file
```

## 🛠️ Setup & Run

### Local Development

1. **Clone/Download** this folder to your computer

2. **Open in browser**: Simply open `index.html` in any web browser
   - No server needed for basic version!
   - Or use Live Server in VS Code for live reload

3. **Start building**: Use Claude Code to add features!

## 🤖 Using Claude Code to Build Features

### Getting Started with Claude Code

1. Open this folder in your terminal
2. Run: `claude-code`
3. Use the prompts below to build features

### Feature Development Prompts

#### **Add More Locations**
```
Add 10 more real Portland locations to data.json. Include a mix of:
- Thrift stores (Salvation Army, St. Vincent de Paul)
- Specialty recyclers (batteries, mattresses)
- Repair cafes and workshops
- Compost drop-off sites

Make sure to include real addresses, lat/lng coordinates, phone numbers, and accurate "accepts" lists.
```

#### **Add Distance Calculation**
```
Add a feature that:
1. Asks user for their location (using browser geolocation API)
2. Calculates distance from user to each location
3. Shows distance in the location cards (e.g., "1.2 miles away")
4. Makes "Sort by Distance" actually work based on real distances
```

#### **Add Favorites/Save Feature**
```
Add ability for users to save favorite locations:
1. Add a star/heart icon to each location card
2. Store favorites in localStorage
3. Add a "My Favorites" filter button
4. Show saved locations even when filtering
```

#### **Improve Search Algorithm**
```
Make the search smarter:
1. Add fuzzy matching (handle typos)
2. Add synonyms (e.g., "tv" = "television" = "monitor")
3. Highlight matching terms in results
4. Show "Did you mean..." suggestions
```

#### **Add Item Categories/Tags**
```
Create a better categorization system:
1. Add item category tags (electronics, furniture, clothing, etc.)
2. Create a visual tag selector instead of just text search
3. Allow multiple tag selection
4. Show how many locations accept each category
```

#### **Mobile Optimization**
```
Improve mobile experience:
1. Add a toggle to switch between list view and map view on mobile
2. Make the map fullscreen on mobile when tapped
3. Add swipe gestures for location cards
4. Optimize touch targets for small screens
```

#### **Add User Contributions**
```
Let users suggest new locations:
1. Add "Suggest a Location" button
2. Create a simple form (name, address, type, items accepted)
3. Store submissions in localStorage for now
4. Display submitted locations with a "pending" badge
```

#### **Analytics & Insights**
```
Add a "Popular Items" feature:
1. Track what people search for (localStorage)
2. Show most searched items
3. Show which items are hardest to find locations for
4. Create an insights dashboard
```

#### **Better Map Features**
```
Enhance the map:
1. Add custom colored pins by type (green=donation, blue=repair, etc.)
2. Add clustering for overlapping markers
3. Show user location on map
4. Add "Get Directions" link (opens Google Maps)
```

#### **Print/Share Features**
```
Add sharing capabilities:
1. "Print this list" button for selected locations
2. "Share this location" - generates shareable link
3. "Email these directions to me"
4. Export to calendar (for drop-off hours)
```

## 🎨 Design Improvements (Claude Code Prompts)

#### **Improve Visual Design**
```
Make the interface more polished:
1. Add smooth animations for cards and filters
2. Improve color scheme with better accessibility
3. Add icons to represent different location types
4. Create a logo for Portland Reuse Hub
5. Add loading states and skeletons
```

#### **Add Dark Mode**
```
Implement a dark mode:
1. Add toggle button in header
2. Create dark color scheme
3. Save preference in localStorage
4. Smooth transition between modes
```

## 📊 Data Expansion (Claude Code Prompts)

#### **Research & Add Locations**
```
I need to add more Portland locations. Can you:
1. Research real Portland businesses that accept [specific items]
2. Find their addresses, hours, and contact info
3. Get accurate lat/lng coordinates
4. Format them for data.json

Focus on: [mattress recycling, battery drop-off, textile recycling, etc.]
```

## 🚀 Advanced Features (Future)

#### **Backend & Database**
```
When ready to scale, add a real backend:
1. Set up a simple Express/Node.js server
2. Use MongoDB or PostgreSQL for locations
3. Add API endpoints for CRUD operations
4. Implement user accounts
```

#### **Admin Panel**
```
Create an admin interface:
1. Add/edit/delete locations
2. Review user submissions
3. Update hours and accepted items
4. View usage analytics
```

## 💡 Tips for Using Claude Code

1. **Be specific**: Instead of "improve the search", say "add autocomplete to the search box"
2. **One feature at a time**: Don't try to build everything at once
3. **Test as you go**: Open the site in your browser after each change
4. **Ask for explanations**: "Explain how this search algorithm works"
5. **Request alternatives**: "Show me 3 different ways to implement favorites"

## 🐛 Common Issues & Fixes

**Map not showing?**
```
Check browser console for errors. Make sure Leaflet CSS/JS are loading.
```

**Data not loading?**
```
If running locally, you might need a simple server due to CORS.
Use: python -m http.server 8000
Then visit: localhost:8000
```

**Search not working?**
```
Check that data.json is valid JSON (use jsonlint.com)
Look for console errors in browser dev tools
```

## 📈 Next Steps

1. ✅ **Test the current version** - Open index.html and try it out!
2. ✅ **Add more locations** - Use Claude Code to expand data.json
3. ✅ **Pick a feature** - Choose from prompts above
4. ✅ **Build iteratively** - One feature at a time
5. ✅ **Deploy it** - Put it online when ready (GitHub Pages, Netlify, Vercel)

## 🌐 Deployment (When Ready)

### GitHub Pages (Free)
1. Create GitHub repo
2. Push code
3. Enable GitHub Pages in settings
4. Done! Site is live

### Netlify (Free)
1. Drag and drop folder to Netlify
2. Done! Auto-deploys on updates

## 📝 Notes

- Data is currently static (data.json)
- No user accounts yet
- No backend/database
- Perfect for MVP/prototype
- Can scale later as needed

## 🎯 Success Metrics

Once live, track:
- Number of searches
- Popular items
- Most viewed locations
- User feedback

---

**Built with passion for Portland's circular economy** 🌱♻️
