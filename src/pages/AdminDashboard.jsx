useEffect(() => {
    const fetchData = async () => {
      try {
        // Cargar reservas
        const resRes = await fetch(`${apiBaseUrl}/api/reservas`);
        const resData = await resRes.json();
        setReservas(resData);
        const suma = resData.reduce((total, item) => total + (item.precio || 30000), 0);
        setIngresos(suma);

        // Cargar torneos
        const tornRes = await fetch(`${apiBaseUrl}/api/torneos`);
        const tornData = await tornRes.json();
        setTorneos(tornData);

        // Cargar equipos por cada torneo
        const equiposMap = {};
        for (const torneo of tornData) {
          const equipRes = await fetch(`${apiBaseUrl}/api/torneos/${torneo.id}/equipos`);
          const equipData = await equipRes.json();
          equiposMap[torneo.id] = equipData;
        }
        setEquiposPorTorneo(equiposMap);

        setLoading(false);
      } catch (err) {
        console.error('Error:', err);
        setLoading(false);
      }
    };

    fetchData();
  }, [apiBaseUrl]);