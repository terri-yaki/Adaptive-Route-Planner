from flask import Flask, jsonify, send_from_directory, render_template, request
from views import main
import requests
from flask_cors import CORS

app = Flask(__name__, static_url_path='/static')
CORS(app)  #enable CORS
app.register_blueprint(main, url_prefix="/") #root

@app.route('/route', methods=['GET'])
def route():
    # Get start and end coordinates from the request arguments
    start = request.args.get('start')
    end = request.args.get('end')

    # Define the API endpoint and query parameters
    url = f"http://router.project-osrm.org/route/v1/driving/{start};{end}"
    params = {
        "steps": "true",
        "geometries": "geojson",
        "overview": "full"
    }

    # Make the HTTP request
    response = requests.get(url, params=params)

    # Extract the route geometry from the response
    route = response.json()["routes"][0]["geometry"]
    return jsonify(route)

@app.route('/static/js/<path:path>')
def serve_static(path):
    return send_from_directory('static/js', path)

@app.route("/proxy", methods=["GET"])
def proxy():
    target_url = request.args.get("url")
    if not target_url:
        return jsonify({"error": "No target URL provided"}), 400

    try:
        response = requests.get(target_url)
        response.raise_for_status()
        return jsonify(response.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=8000)
