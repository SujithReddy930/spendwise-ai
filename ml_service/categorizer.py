from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
import numpy as np

TRAINING_DATA = [
    ("dominos pizza", "Food"), ("zomato", "Food"), ("swiggy", "Food"),
    ("mcdonalds", "Food"), ("kfc", "Food"), ("burger king", "Food"),
    ("subway", "Food"), ("pizza hut", "Food"), ("starbucks", "Food"),
    ("cafe coffee day", "Food"), ("restaurant", "Food"), ("biryani", "Food"),
    ("hotel food", "Food"), ("mess", "Food"), ("canteen", "Food"),
    ("grocery", "Food"), ("supermarket", "Food"), ("vegetables", "Food"),
    ("fruits", "Food"), ("milk", "Food"), ("bakery", "Food"),
    ("haldirams", "Food"), ("blinkit", "Food"), ("bigbasket", "Food"),
    ("zepto", "Food"), ("dunzo groceries", "Food"),

    ("ola", "Transport"), ("uber", "Transport"), ("rapido", "Transport"),
    ("auto", "Transport"), ("bus ticket", "Transport"), ("metro", "Transport"),
    ("train ticket", "Transport"), ("irctc", "Transport"), ("petrol", "Transport"),
    ("fuel", "Transport"), ("diesel", "Transport"), ("cab", "Transport"),
    ("indigo", "Transport"), ("air india", "Transport"), ("flight", "Transport"),
    ("parking", "Transport"), ("toll", "Transport"),

    ("amazon", "Shopping"), ("flipkart", "Shopping"), ("myntra", "Shopping"),
    ("meesho", "Shopping"), ("ajio", "Shopping"), ("nykaa", "Shopping"),
    ("clothes", "Shopping"), ("shoes", "Shopping"), ("shirt", "Shopping"),
    ("dress", "Shopping"), ("jeans", "Shopping"), ("electronics", "Shopping"),
    ("mobile", "Shopping"), ("laptop", "Shopping"), ("headphones", "Shopping"),

    ("electricity", "Bills"), ("electric bill", "Bills"), ("water bill", "Bills"),
    ("internet", "Bills"), ("broadband", "Bills"), ("airtel", "Bills"),
    ("jio", "Bills"), ("vi", "Bills"), ("recharge", "Bills"),
    ("netflix", "Bills"), ("spotify", "Bills"), ("amazon prime", "Bills"),
    ("hotstar", "Bills"), ("rent", "Bills"), ("emi", "Bills"),
    ("insurance", "Bills"), ("loan", "Bills"),

    ("hospital", "Health"), ("doctor", "Health"), ("clinic", "Health"),
    ("pharmacy", "Health"), ("medicine", "Health"), ("apollo", "Health"),
    ("medplus", "Health"), ("netmeds", "Health"), ("pharmeasy", "Health"),
    ("gym", "Health"), ("fitness", "Health"), ("yoga", "Health"),
    ("blood test", "Health"), ("lab test", "Health"),

    ("bookmyshow", "Entertainment"), ("movie", "Entertainment"),
    ("cinema", "Entertainment"), ("pvr", "Entertainment"), ("inox", "Entertainment"),
    ("concert", "Entertainment"), ("game", "Entertainment"),
    ("playstation", "Entertainment"), ("xbox", "Entertainment"),
    ("steam", "Entertainment"), ("bowling", "Entertainment"),

    ("udemy", "Education"), ("coursera", "Education"), ("books", "Education"),
    ("stationery", "Education"), ("college fee", "Education"), ("tuition", "Education"),
    ("school fee", "Education"), ("coaching", "Education"),
    ("notebook", "Education"), ("course", "Education"),
]

texts = [t for t, _ in TRAINING_DATA]
labels = [l for _, l in TRAINING_DATA]

model = Pipeline([
    ('tfidf', TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
    ('clf', LogisticRegression(max_iter=1000, C=5))
])
model.fit(texts, labels)

def predict_category(title: str) -> dict:
    title_clean = title.lower().strip()
    predicted = model.predict([title_clean])[0]
    probabilities = model.predict_proba([title_clean])[0]
    confidence = float(np.max(probabilities))
    return {
        "category": predicted,
        "confidence": round(confidence * 100, 1)
    }