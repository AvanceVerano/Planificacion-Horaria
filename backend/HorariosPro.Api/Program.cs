using HorariosPro.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
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
        // Configuración para Railway (PostgreSQL)
        var uri = new Uri(railwayDbUrl);
        var userInfo = uri.UserInfo.Split(':');
        var connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};Ssl Mode=Require;Trust Server Certificate=true;";
        
        options.UseNpgsql(connectionString);
    }
    else
    {
        // Configuración para tu PC Local (SQLite)
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

// 3. AUTO-MIGRACIONES EN PRODUCCIÓN (¡Vital para Railway!)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<HorariosProDbContext>();
    // Esto crea las tablas en Postgres automáticamente si no existen
    db.Database.Migrate(); 
}

// Aplicar la política de CORS correcta
app.UseCors("AllowVercel");

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
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