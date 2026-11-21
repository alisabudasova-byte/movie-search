import { useEffect, useState } from "react";

function MovieCard({ movie }) {
  // Состояние описания фильма
  const [plot, setPlot] = useState("");

  // Состояние загрузки описания
  const [loading, setLoading] = useState(false);

  // Состояние ошибки
  const [error, setError] = useState("");

  // Проверяем, удалось ли загрузить постер
  const [posterError, setPosterError] = useState(false);

  // Загружаем описание фильма при появлении карточки
  useEffect(() => {
    const controller = new AbortController();

    const fetchPlot = async () => {
      setLoading(true);
      setError("");

      try {
        const apiKey = import.meta.env.VITE_OMDB_API_KEY;

        const response = await fetch(
          `https://www.omdbapi.com/?i=${movie.imdbID}&plot=short&apikey=${apiKey}`,
          { signal: controller.signal },
        );

        const data = await response.json();

        if (data.Response === "True") {
          setPlot(data.Plot);
        } else {
          setError("Описание недоступно");
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          setError("Не удалось загрузить описание");
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchPlot();

    // Отменяем запрос, если карточка исчезает
    return () => controller.abort();
  }, [movie.imdbID]);

  // Определяем, какой постер показывать
  const posterUrl =
    movie.Poster && movie.Poster !== "N/A" && !posterError
      ? movie.Poster
      : "https://placehold.co/300x450?text=No+Poster";

  return (
    <article className="movie-card">
      {/* Постер фильма или заглушка */}
      <img
        src={posterUrl}
        alt={movie.Title}
        onError={() => setPosterError(true)}
      />

      {/* Название фильма */}
      <h2>{movie.Title}</h2>

      {/* Год выпуска */}
      <p>Год выпуска: {movie.Year}</p>

      {/* Индикатор загрузки описания */}
      {loading && <p>Загрузка описания...</p>}

      {/* Сообщение об ошибке */}
      {error && <p className="error">{error}</p>}

      {/* Краткое описание фильма */}
      {!loading && plot && plot !== "N/A" && (
        <p className="movie-plot">{plot}</p>
      )}
    </article>
  );
}

export default MovieCard;
