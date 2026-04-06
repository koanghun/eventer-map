import os
import googlemaps
from dotenv import load_dotenv

load_dotenv()

def test_resolve():
    api_key = os.getenv("GOOGLE_MAPS_API_KEY")
    if not api_key:
        api_key = os.getenv("REACT_APP_GOOGLE_MAPS_API_KEY")
    
    print(f"Using API Key: {api_key[:10]}...")
    
    try:
        client = googlemaps.Client(key=api_key)
        
        # 1. Search
        query = "LaLa arena TOKYO-BAY"
        print(f"Searching for: {query}")
        search_res = client.find_place(
            input=query,
            input_type='textquery',
            language='ja',
            fields=['place_id']
        )
        print(f"Search Status: {search_res.get('status')}")
        
        if search_res.get('status') == 'OK' and search_res.get('candidates'):
            google_place_id = search_res['candidates'][0].get('place_id')
            print(f"Found Place ID: {google_place_id}")
            
            # 2. Details (Using exact fields from routes/places.py)
            fields = ['name', 'formatted_address', 'geometry', 'address_components', 'types']
            print(f"Fetching details for {google_place_id} with fields: {fields}")
            
            details_res = client.place(
                place_id=google_place_id,
                language='ja',
                fields=fields
            )
            print(f"Details Status: {details_res.get('status')}")
            
            if details_res.get('status') == 'OK':
                result = details_res.get('result', {})
                geometry = result.get('geometry', {})
                location = geometry.get('location', {})
                print(f"SUCCESS! Name: {result.get('name')}, Lat: {location.get('lat')}, Lng: {location.get('lng')}")
            else:
                print(f"FAILURE in Details: {details_res.get('error_message', 'No error message')}")
        else:
            print(f"FAILURE in Search: {search_res.get('error_message', 'No error message')}")
            
    except Exception as e:
        print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    test_resolve()
