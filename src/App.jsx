import { useEffect, useRef, useState } from "react";
import MovieCard from "./MovieCard";
import "./App.css";

// Получаем API-ключ из файла .env.local
const API_KEY = import.meta.env.VITE_OMDB_API_KEY;

function App() {
  // Основные состояния приложения
  const [query, setQuery] = useState("");
  const [movies, setMovies] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");

  // Состояния фильтрации по годам
  const [yearFrom, setYearFrom] = useState("");
  const [yearTo, setYearTo] = useState("");

  // Состояния пагинации
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);

  // История последних пяти поисковых запросов
  const [history, setHistory] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("movieHistory")) || [];
    } catch {
      return [];
    }
  });

  // Ссылка на таймер автоматического поиска
  const timerRef = useRef(null);

  // Ссылка на текущий запрос. Нужна для отмены предыдущего запроса
  const controllerRef = useRef(null);

  // Общее количество страниц (OMDb возвращает по 10 фильмов)
  const totalPages = Math.ceil(totalResults / 10);

  // Сохраняем историю поиска в localStorage
  useEffect(() => {
    localStorage.setItem("movieHistory", JSON.stringify(history));
  }, [history]);

  // Функция поиска фильмов через OMDb API
  const fetchMovies = async (searchQuery, currentPage = 1) => {
    const trimmedQuery = searchQuery.trim();

    // Проверяем, что пользователь ввёл не менее трёх символов
    if (trimmedQuery.length < 3) {
      setMovies([]);
      setTotalResults(0);
      setStatus("idle");
      setError("");
      return;
    }

    // Отменяем предыдущий запрос, если он ещё выполняется
    if (controllerRef.current) {
      controllerRef.current.abort();
    }

    const controller = new AbortController();
    controllerRef.current = controller;

    // Включаем состояние загрузки
    setStatus("loading");
    setError("");
    setPage(currentPage);

    try {
      // Формируем адрес запроса с учётом страницы
      const url = `https://www.omdbapi.com/?s=${encodeURIComponent(
        trimmedQuery,
      )}&page=${currentPage}&apikey=${API_KEY}`;

      const response = await fetch(url, {
        signal: controller.signal,
      });

      // Проверяем успешность HTTP-запроса
      if (!response.ok) {
        throw new Error("Ошибка соединения с сервером");
      }

      const data = await response.json();

      // Обрабатываем ответ API, если фильмы не найдены
      if (data.Response === "False") {
        // Ошибка Movie not found означает, что совпадений нет
        if (data.Error === "Movie not found!") {
          setMovies([]);
          setTotalResults(0);
          setStatus("success");
        } else {
          throw new Error(data.Error || "Не удалось выполнить поиск");
        }

        return;
      }

      // Сохраняем найденные фильмы
      setMovies(data.Search || []);

      // Получаем общее количество результатов для пагинации
      setTotalResults(Number(data.totalResults) || 0);

      // Переключаем приложение в состояние успешного поиска
      setStatus("success");

      // Добавляем запрос в историю, не повторяя одинаковые запросы
      setHistory((previousHistory) => {
        const updatedHistory = [
          trimmedQuery,
          ...previousHistory.filter(
            (item) => item.toLowerCase() !== trimmedQuery.toLowerCase(),
          ),
        ];

        // Оставляем только последние пять запросов
        return updatedHistory.slice(0, 5);
      });
    } catch (err) {
      // Не показываем ошибку, если запрос был отменён
      if (err.name === "AbortError") {
        return;
      }

      setError(err.message || "Произошла ошибка при поиске");
      setStatus("error");
      setMovies([]);
      setTotalResults(0);
    } finally {
      // Завершаем загрузку только для актуального запроса
      if (!controller.signal.aborted) {
        setStatus((currentStatus) =>
          currentStatus === "loading" ? "success" : currentStatus,
        );
      }
    }
  };

  // Автоматический поиск с задержкой 500 миллисекунд
  useEffect(() => {
    // Если запрос слишком короткий, очищаем результаты
    if (query.trim().length < 3) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      if (controllerRef.current) {
        controllerRef.current.abort();
      }

      setMovies([]);
      setTotalResults(0);
      setPage(1);
      setStatus("idle");
      setError("");

      return;
    }

    // Запускаем поиск только после небольшой паузы при вводе
    timerRef.current = setTimeout(() => {
      fetchMovies(query, 1);
    }, 500);

    // Очищаем таймер при изменении запроса или удалении компонента
    return () => {
      clearTimeout(timerRef.current);
    };
  }, [query]);

  // Обработчик нажатия кнопки «Найти»
  const handleSearch = () => {
    if (query.trim().length < 3 || status === "loading") {
      return;
    }

    // Отменяем отложенный автоматический поиск,
    // чтобы не отправлять два одинаковых запроса
    clearTimeout(timerRef.current);

    fetchMovies(query, 1);
  };

  // Переход на предыдущую страницу
  const handlePreviousPage = () => {
    if (page > 1 && status !== "loading") {
      fetchMovies(query, page - 1);
    }
  };

  // Переход на следующую страницу
  const handleNextPage = () => {
    if (page < totalPages && status !== "loading") {
      fetchMovies(query, page + 1);
    }
  };

  // Выбор поискового запроса из истории
  const handleHistoryClick = (item) => {
    clearTimeout(timerRef.current);

    // Устанавливаем выбранный запрос в поле ввода.
    // Автоматический поиск выполнится через 500 мс.
    setQuery(item);
    setPage(1);
  };

  // Фильтрация найденных фильмов по указанному диапазону годов
  const filteredMovies = movies.filter((movie) => {
    // У OMDb год иногда представлен диапазоном, например 2010–2015.
    // Для фильтрации используем первый указанный год.
    const movieYear = parseInt(movie.Year, 10);

    const matchesFrom = yearFrom === "" || movieYear >= Number(yearFrom);

    const matchesTo = yearTo === "" || movieYear <= Number(yearTo);

    return matchesFrom && matchesTo;
  });

  // Сброс фильтра по годам
  const resetYearFilter = () => {
    setYearFrom("");
    setYearTo("");
  };

  return (
    <div className="app">
      {/* Название приложения */}
      <h1>Поиск фильмов</h1>

      {/* Поле ввода и кнопка поиска */}
      <div className="search">
        <input
          type="text"
          placeholder="Введите название фильма..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              handleSearch();
            }
          }}
        />

        <button
          onClick={handleSearch}
          disabled={status === "loading" || query.trim().length < 3}
        >
          Найти
        </button>
      </div>

      {/* История последних пяти поисковых запросов */}
      {history.length > 0 && (
        <div className="history">
          <h3>История поиска:</h3>

          <div className="history-list">
            {history.map((item, index) => (
              <button
                key={`${item}-${index}`}
                onClick={() => handleHistoryClick(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Дополнительное задание: фильтрация по годам */}
      <div className="year-filter">
        <label htmlFor="yearFrom">Год от:</label>

        <input
          id="yearFrom"
          type="number"
          min="0"
          max="2026"
          placeholder="2000"
          value={yearFrom}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "" || (Number(value) >= 0 && Number(value) <= 2026)) {
              setYearFrom(value);
            }
          }}
        />

        <label htmlFor="yearTo">Год до:</label>

        <input
          id="yearTo"
          type="number"
          min="0"
          max="2026"
          placeholder="2020"
          value={yearTo}
          onChange={(event) => {
            const value = event.target.value;

            if (value === "" || (Number(value) >= 0 && Number(value) <= 2026)) {
              setYearTo(value);
            }
          }}
        />

        <button onClick={resetYearFilter}>Сбросить</button>
      </div>

      {/* Состояние ожидания поиска */}
      {status === "idle" && <p>Введите название фильма для поиска.</p>}

      {/* Состояние загрузки */}
      {status === "loading" && <p>Загрузка фильмов...</p>}

      {/* Сообщение об ошибке */}
      {status === "error" && <p className="error">Ошибка: {error}</p>}

      {/* Сообщение, если поиск завершился без результатов */}
      {status === "success" && movies.length === 0 && <p>Ничего не найдено.</p>}

      {/* Сообщение, если фильмы есть, но фильтр исключил их */}
      {status === "success" &&
        movies.length > 0 &&
        filteredMovies.length === 0 && (
          <p>Нет фильмов, подходящих под выбранный диапазон годов.</p>
        )}

      {/* Сетка карточек фильмов */}
      <div className="movies">
        {filteredMovies.map((movie) => (
          <MovieCard key={movie.imdbID} movie={movie} />
        ))}
      </div>

      {/* Дополнительное задание: переключение страниц */}
      {status === "success" && totalPages > 1 && (
        <div className="pagination">
          <button
            onClick={handlePreviousPage}
            disabled={page === 1 || status === "loading"}
          >
            Назад
          </button>

          <span>
            Страница {page} из {totalPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={page >= totalPages || status === "loading"}
          >
            Вперёд
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
