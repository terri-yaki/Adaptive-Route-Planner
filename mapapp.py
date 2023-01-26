from flask import *
from views import main

app = Flask(__name__)
app.register_blueprint(main, url_prefix="/main") #root


if __name__ == '__main__':
    app.run(debug=True, port=8000)