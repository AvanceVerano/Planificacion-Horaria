using HorariosPro.Api.Data;
using Microsoft.EntityFrameworkCore;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddOpenApi();
builder.Services.AddControllers();
builder.Services.AddDbContext<HorariosProDbContext>(options =>
    options.UseSqlite(builder.Configuration.GetConnectionString("HorariosPro") ?? "Data Source=horariospro.db"));
builder.Services.AddScoped<HorariosPro.Api.Services.HorarioGenerator>();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

if (app.Configuration.GetValue("SeedData:Enabled", true))
{
    await JsonSeedData.SeedAsync(app.Services);
}

app.MapControllers();

app.Run();
