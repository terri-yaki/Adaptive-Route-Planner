from flask import Blueprint, render_template
import folium

main = Blueprint(__name__, "main")

@main.route("/")
def home():
    return render_template("index.html", name="1")

@main.route("/map")
def map():
    osm = folium.Map(location=[45.523, -122.675], zoom_start=13)
    return render_template("index.html")