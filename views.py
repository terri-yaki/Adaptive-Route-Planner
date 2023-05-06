from flask import *
import smtplib
import folium

main = Blueprint(__name__, "main")

@main.route("/")
def home():
    return render_template("index.html")

@main.route("/contact", methods=["GET", "POST"])
def contact_form():
    if request.method == "POST":
        name = request.form["name"]
        email = request.form["email"]
        phone = request.form["phone"]
        message = request.form["message"]
        
        # Set up SMTP server settings
        smtp_server = "smtp.gmail.com"
        smtp_port = 587
        smtp_username = email
        smtp_password = "your_email_password"
        sender_email = smtp_username
        recipient_email = "hl01341@surrey.ac.uk"
        
        # Create the email message
        subject = "New contact form submission"
        body = f"Name: {name}\nEmail: {email}\nPhone: {phone}\nMessage: {message}"
        message = f"Subject: {subject}\n\n{body}"
        
        # Send the email
        with smtplib.SMTP(smtp_server, smtp_port) as server:
            server.starttls()
            server.login(smtp_username, smtp_password)
            server.sendmail(sender_email, recipient_email, message)

        return "Form submitted successfully!"

    return render_template("contact.html")
