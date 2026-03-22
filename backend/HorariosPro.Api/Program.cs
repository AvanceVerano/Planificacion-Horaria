using HorariosPro.Api.Data;
using Microsoft.EntityFrameworkCore;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddScoped<HorariosPro.Api.Services.HorarioGenerator>();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// 1. CONFIGURACIÓN DE BASE DE DATOS (Híbrida: Prod Postgres / Local SQLite)
var railwayDbUrl = Environment.GetEnvironmentVariable("DATABASE_URL");

builder.Services.AddDbContext<HorariosProDbContext>(options =>
{
    if (!string.IsNullOrEmpty(railwayDbUrl))
    {
        // Limpieza robusta de la URL de Railway
        var databaseUri = new Uri(railwayDbUrl);
        var dbUserInfo = databaseUri.UserInfo.Split(':');
        
        var connectionString = new NpgsqlConnectionStringBuilder
        {
            Host = databaseUri.Host,
            Port = databaseUri.Port,
            Database = databaseUri.AbsolutePath.TrimStart('/'),
            Username = dbUserInfo[0],
            Password = dbUserInfo[1],
            SslMode = SslMode.Require
        }.ToString();
        
        options.UseNpgsql(connectionString);
    }
    else
    {
        options.UseSqlite(builder.Configuration.GetConnectionString("HorariosPro") ?? "Data Source=horariospro.db");
    }
});

// 2. CONFIGURACIÓN DE CORS PARA VERCEL
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowVercel", policy =>
    {
        // Agregamos también 127.0.0.1 por si acaso Live Server lo usa
        policy.WithOrigins("https://planificacion-horaria.vercel.app", "http://localhost:5500", "http://127.0.0.1:5500") 
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

// 3. AUTO-CREACIÓN DE TABLAS EN PRODUCCIÓN Y LOCAL
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    try 
    {
        var db = services.GetRequiredService<HorariosProDbContext>();
        Console.WriteLine("Generando base de datos...");
        
        db.Database.EnsureCreated(); 
        
        Console.WriteLine("¡Base de datos lista!");
    }
    catch (Exception ex)
    {
        Console.WriteLine($"Error en base de datos: {ex.Message}");
    }
}

// Aplicar la política de CORS correcta
app.UseCors("AllowVercel");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();

// 4. Inyección de datos JSON
if (app.Configuration.GetValue("SeedData:Enabled", true))
{
    await JsonSeedData.SeedAsync(app.Services);
}

app.MapControllers();

app.Run();